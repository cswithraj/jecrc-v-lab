import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { LANGUAGES } from "./languages";

export type RunStatus = "OK" | "RUNTIME_ERROR" | "TIME_LIMIT_EXCEEDED" | "MEMORY_LIMIT_EXCEEDED" | "OUTPUT_LIMIT_EXCEEDED" | "INTERNAL_ERROR";

export interface ExecuteRequest {
  language: string;
  source: string;
  inputs: string[]; // one run per input (e.g. per test case)
  timeLimitMs?: number;
  memoryLimitKb?: number;
  outputLimitBytes?: number;
}
export interface RunResult {
  status: RunStatus;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: number | null;
  timeMs: number; // CPU time
  wallMs: number;
  memoryKb: number | null;
}
export interface ExecuteResponse {
  compile: { ok: boolean; output: string; timeMs: number };
  runs: RunResult[];
}

const RUNNER_DIR = __dirname;
const WORK_ROOT = process.env.RUNNER_WORKDIR || tmpdir();
const IS_ROOT = typeof process.getuid === "function" && process.getuid() === 0;
// Each concurrency slot runs under its own unprivileged uid so per-uid limits (RLIMIT_NPROC)
// are not shared between jobs, and stray processes can be reaped by uid afterwards.
const SANDBOX_UID_BASE = Number(process.env.RUNNER_SANDBOX_UID_BASE || 61000);
const SANDBOX_GID = Number(process.env.RUNNER_SANDBOX_GID || 65534);
const USE_UNSHARE = process.env.RUNNER_UNSHARE_NET !== "false" && IS_ROOT && commandWorks(["unshare", "-n", "true"]);
const MAX_SOURCE = 64 * 1024;
const MAX_INPUT = 1024 * 1024;
const MAX_RUNS = 50;

let VRUN = path.join(WORK_ROOT, "vlab-vrun");

function commandWorks(cmd: string[]) {
  try { execFileSync(cmd[0], cmd.slice(1), { stdio: "ignore", timeout: 3000 }); return true; } catch { return false; }
}

export function prepare() {
  const src = path.join(RUNNER_DIR, "vrun.c");
  VRUN = path.join(WORK_ROOT, "vlab-vrun");
  execFileSync("gcc", ["-O2", "-o", VRUN, src]);
  return { isRoot: IS_ROOT, unshareNet: USE_UNSHARE, languages: Object.keys(LANGUAGES) };
}

/** Build the hardened command line: [unshare -n] [setpriv drop] prlimit … vrun stats cmd */
function wrap(cmd: string[], statsFile: string, opts: { cpuSec: number; asKb: number | null; fsizeBytes: number; nproc: number; uid: number }) {
  const limits = [
    "prlimit",
    `--cpu=${opts.cpuSec}`,
    `--fsize=${opts.fsizeBytes}`,
    `--nofile=64`,
    `--core=0`,
    `--nproc=${opts.nproc}`,
    ...(opts.asKb ? [`--as=${opts.asKb * 1024}`] : []),
    "--",
  ];
  const drop = IS_ROOT ? ["setpriv", `--reuid=${opts.uid}`, `--regid=${SANDBOX_GID}`, "--clear-groups", "--no-new-privs", "--inh-caps=-all", "--"] : [];
  const net = USE_UNSHARE ? ["unshare", "-n", "--"] : [];
  return [...net, ...drop, ...limits, VRUN, statsFile, ...cmd];
}

interface ProcOut { stdout: string; stderr: string; wallMs: number; killedFor: "time" | "output" | null; code: number | null }

function runProc(cmd: string[], cwd: string, stdin: string, wallLimitMs: number, outLimit: number): Promise<ProcOut> {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(cmd[0], cmd.slice(1), {
      cwd,
      detached: true, // own process group so we can kill everything it forks
      env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: cwd, LANG: "C.UTF-8", JAVA_TOOL_OPTIONS: "" } as unknown as NodeJS.ProcessEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = Buffer.alloc(0), err = Buffer.alloc(0), killedFor: ProcOut["killedFor"] = null;
    const kill = (why: ProcOut["killedFor"]) => {
      if (killedFor) return;
      killedFor = why;
      try { process.kill(-child.pid!, "SIGKILL"); } catch { /* already gone */ }
    };
    const timer = setTimeout(() => kill("time"), wallLimitMs);
    child.stdout.on("data", (d: Buffer) => { out = Buffer.concat([out, d]); if (out.length > outLimit) kill("output"); });
    child.stderr.on("data", (d: Buffer) => { if (err.length < 65536) err = Buffer.concat([err, d]); });
    child.stdin.on("error", () => {});
    child.stdin.end(stdin);
    child.on("close", (code) => {
      clearTimeout(timer);
      try { process.kill(-child.pid!, "SIGKILL"); } catch { /* group already gone */ }
      resolve({ stdout: out.subarray(0, outLimit).toString("utf8"), stderr: err.toString("utf8").slice(0, 65536), wallMs: Date.now() - started, killedFor, code });
    });
    child.on("error", (e) => { clearTimeout(timer); resolve({ stdout: "", stderr: String(e), wallMs: Date.now() - started, killedFor: null, code: -1 }); });
  });
}

async function readStats(file: string) {
  try {
    const [exit, sig, rss, cpu] = (await readFile(file, "utf8")).trim().split(/\s+/).map(Number);
    return { exit, sig, rss, cpu };
  } catch { return null; }
}

/** Kill every process left behind by a slot's uid and wait until they are gone,
 *  so the next job on this slot starts with a clean process count. */
function reap(uid: number) {
  if (!IS_ROOT) return;
  for (let i = 0; i < 50; i++) {
    try { execFileSync("pkill", ["-9", "-U", String(uid)], { stdio: "ignore", timeout: 3000 }); } catch { return; /* exit 1 = nothing matched */ }
    execFileSync("sleep", ["0.05"]);
  }
}

export async function execute(req: ExecuteRequest, slot = 0): Promise<ExecuteResponse> {
  const uid = SANDBOX_UID_BASE + slot;
  const spec = LANGUAGES[req.language];
  if (!spec) throw new Error(`Unsupported language ${req.language}`);
  if (typeof req.source !== "string" || req.source.length > MAX_SOURCE) throw new Error("Source missing or too large (64 KB max)");
  const inputs = (req.inputs?.length ? req.inputs : [""]).slice(0, MAX_RUNS);
  if (inputs.some((i) => i.length > MAX_INPUT)) throw new Error("Input too large");
  const timeLimitMs = Math.min(Math.max(req.timeLimitMs ?? 2000, 100), 10000);
  const memKb = Math.min(Math.max(req.memoryLimitKb ?? 131072, 16384), 524288);
  const outLimit = Math.min(req.outputLimitBytes ?? 65536, 1024 * 1024);

  const dir = await mkdtemp(path.join(WORK_ROOT, "vlab-job-"));
  await chmod(dir, 0o777);
  try {
    if (!spec.sourceAsStdin) {
      await writeFile(path.join(dir, spec.file), req.source, { mode: 0o644 });
    }
    // ── compile ──
    let compile = { ok: true, output: "", timeMs: 0 };
    if (spec.compile) {
      const stats = path.join(dir, ".cstats");
      const cmd = wrap(spec.compile, stats, { cpuSec: 20, asKb: null, fsizeBytes: 64 * 1024 * 1024, nproc: 256, uid });
      const r = await runProc(cmd, dir, "", 30000, 256 * 1024);
      const s = await readStats(stats);
      compile = { ok: !r.killedFor && s?.exit === 0, output: (r.stdout + r.stderr).replaceAll(dir + "/", "").slice(0, 20000) || (r.killedFor ? "Compilation timed out" : ""), timeMs: r.wallMs };
      if (!compile.ok) return { compile, runs: [] };
    }
    // ── run each input ──
    const runs: RunResult[] = [];
    for (let i = 0; i < inputs.length; i++) {
      const stats = path.join(dir, `.rstats${i}`);
      const runCmd = spec.run.map((a) => a.replace("{MEM}", String(memKb)).replace("{RUNNER_DIR}", RUNNER_DIR));
      const asKb = spec.memoryMode === "jvm" ? null : memKb + 16384;
      const cmd = wrap(runCmd, stats, { cpuSec: Math.ceil(timeLimitMs / 1000) + 1, asKb, fsizeBytes: 1024 * 1024, nproc: spec.memoryMode === "jvm" ? 256 : 64, uid });
      const stdin = spec.sourceAsStdin ? `${inputs[i]}\n${req.source}` : inputs[i];
      const r = await runProc(cmd, dir, stdin, timeLimitMs * 3 + 1000, outLimit);
      reap(uid);
      const s = await readStats(stats);
      const cpu = s?.cpu ?? r.wallMs;
      let status: RunStatus = "OK";
      const stderr = r.stderr.replaceAll(dir + "/", "");
      if (r.killedFor === "output") status = "OUTPUT_LIMIT_EXCEEDED";
      else if (r.killedFor === "time" || cpu > timeLimitMs || s?.sig === 24 /* SIGXCPU */) status = "TIME_LIMIT_EXCEEDED";
      else if (s && s.rss > memKb) status = "MEMORY_LIMIT_EXCEEDED";
      else if (!s) status = "INTERNAL_ERROR";
      else if (s.sig !== 0 || s.exit !== 0) status = /OutOfMemoryError|MemoryError|bad_alloc|heap out of memory/.test(stderr) ? "MEMORY_LIMIT_EXCEEDED" : "RUNTIME_ERROR";
      runs.push({ status, stdout: r.stdout, stderr, exitCode: s?.exit ?? r.code, signal: s?.sig ?? null, timeMs: cpu, wallMs: r.wallMs, memoryKb: s?.rss ?? null });
    }
    return { compile, runs };
  } finally {
    reap(uid);
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export const sandboxInfo = () => ({ isRoot: IS_ROOT, unshareNet: USE_UNSHARE, vrun: existsSync(VRUN) });
