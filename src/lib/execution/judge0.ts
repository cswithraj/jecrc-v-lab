import type { Language } from "@prisma/client";
import type { ExecRequest, ExecResult, ExecRun, ExecutionProvider } from "./types";
import { ExecutionUnavailableError } from "./types";

// Judge0 CE language ids — adjust if your Judge0 instance exposes different versions (GET /languages).
const JUDGE0_IDS: Partial<Record<Language, number>> = { C: 50, CPP: 54, JAVA: 62, PYTHON: 71, JAVASCRIPT: 63, SQL: 82, SHELL: 46 };

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const unb64 = (s?: string | null) => (s ? Buffer.from(s, "base64").toString("utf8") : "");

/** Judge0 (self-hosted CE or RapidAPI). Each input is a separate submission (wait=true), sent in parallel batches. */
export const judge0Provider: ExecutionProvider = {
  name: "judge0",
  async execute(req: ExecRequest): Promise<ExecResult> {
    const base = process.env.JUDGE0_URL;
    if (!base) throw new ExecutionUnavailableError("Judge0 is not configured (JUDGE0_URL).");
    const id = JUDGE0_IDS[req.language];
    if (!id) throw new Error(`Language ${req.language} is not mapped for Judge0`);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (process.env.JUDGE0_API_KEY) {
      headers["X-RapidAPI-Key"] = process.env.JUDGE0_API_KEY;
      if (process.env.JUDGE0_API_HOST) headers["X-RapidAPI-Host"] = process.env.JUDGE0_API_HOST;
      headers["X-Auth-Token"] = process.env.JUDGE0_API_KEY;
    }
    // Submissions run in parallel (max 4 at a time) so a multi-test run fits serverless time limits.
    const inputs = req.inputs.length ? req.inputs : [""];
    const one = async (input: string) => {
      const source = req.language === "SQL" ? `${input}\n${req.source}` : req.source;
      const res = await fetch(`${base}/submissions?base64_encoded=true&wait=true`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          language_id: id,
          source_code: b64(source),
          stdin: b64(req.language === "SQL" ? "" : input),
          cpu_time_limit: req.timeLimitMs / 1000,
          wall_time_limit: (req.timeLimitMs * 3) / 1000,
          memory_limit: req.memoryLimitKb,
          enable_network: false,
        }),
        cache: "no-store",
      }).catch(() => null);
      if (res?.status === 429) throw new ExecutionUnavailableError("The code execution service's quota is used up for now. Try again later.");
      if (!res || !res.ok) throw new ExecutionUnavailableError(`Judge0 request failed${res ? ` (${res.status})` : ""}`);
      return res.json() as Promise<{ status?: { id: number }; stdout?: string; stderr?: string; compile_output?: string; time?: string; memory?: number }>;
    };
    const results: Awaited<ReturnType<typeof one>>[] = [];
    for (let i = 0; i < inputs.length; i += 4) results.push(...(await Promise.all(inputs.slice(i, i + 4).map(one))));
    const compileErr = results.find((r) => r.status?.id === 6);
    if (compileErr) return { compile: { ok: false, output: unb64(compileErr.compile_output) }, runs: [] };
    const compile = { ok: true, output: "" };
    const runs: ExecRun[] = results.map((r) => {
      const statusId = r.status?.id ?? 13;
      const status: ExecRun["status"] = statusId === 3 || statusId === 4 ? "OK" : statusId === 5 ? "TIME_LIMIT_EXCEEDED" : statusId >= 7 && statusId <= 12 ? "RUNTIME_ERROR" : "INTERNAL_ERROR";
      return { status, stdout: unb64(r.stdout), stderr: unb64(r.stderr), timeMs: Math.round(Number(r.time || 0) * 1000), memoryKb: r.memory ?? null };
    });
    return { compile, runs };
  },
};
