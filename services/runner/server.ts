/**
 * JECRC VLab sandbox runner — a separate service that executes untrusted student code.
 * NEVER run this inside the web-app process/container. Deploy it in its own container with
 * no network egress, read-only root FS, tmpfs work dir, pids/cpu/memory cgroup limits
 * (see docker/runner.Dockerfile and docker-compose.yml).
 */
import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import os from "node:os";
import { execute, prepare, sandboxInfo, type ExecuteRequest } from "./sandbox";

const PORT = Number(process.env.RUNNER_PORT || 4100);
const SECRET = process.env.RUNNER_SECRET || "";
const CONCURRENCY = Number(process.env.RUNNER_CONCURRENCY || Math.max(1, os.cpus().length - 1));
const MAX_QUEUE = Number(process.env.RUNNER_MAX_QUEUE || 200);

if (SECRET.length < 16) {
  console.error("RUNNER_SECRET must be set (>=16 chars)");
  process.exit(1);
}
const info = prepare();
console.log("[runner] sandbox", info);

// Slot pool: each slot = one concurrent job with its own sandbox uid.
const free: number[] = Array.from({ length: CONCURRENCY }, (_, i) => i);
const queue: Array<(slot: number) => void> = [];
let active = 0;
function acquire(): Promise<number> {
  const slot = free.pop();
  if (slot !== undefined) { active++; return Promise.resolve(slot); }
  return new Promise((res) => queue.push((s) => { active++; res(s); }));
}
function release(slot: number) {
  active--;
  const next = queue.shift();
  if (next) next(slot); else free.push(slot);
}

function authed(req: http.IncomingMessage) {
  const h = req.headers.authorization || "";
  const token = Buffer.from(h.replace(/^Bearer /, ""));
  const secret = Buffer.from(SECRET);
  return token.length === secret.length && timingSafeEqual(token, secret);
}

function send(res: http.ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true, active, queued: queue.length, ...sandboxInfo() });
  if (req.method !== "POST" || req.url !== "/execute") return send(res, 404, { error: "not found" });
  if (!authed(req)) return send(res, 401, { error: "unauthorized" });
  if (queue.length >= MAX_QUEUE) return send(res, 429, { error: "runner busy, retry shortly" });

  let body = "";
  let tooBig = false;
  req.on("data", (c) => { body += c; if (body.length > 4 * 1024 * 1024) { tooBig = true; req.destroy(); } });
  req.on("end", async () => {
    if (tooBig) return;
    let payload: ExecuteRequest;
    try { payload = JSON.parse(body); } catch { return send(res, 400, { error: "invalid json" }); }
    const slot = await acquire();
    try {
      send(res, 200, await execute(payload, slot));
    } catch (e) {
      send(res, 400, { error: (e as Error).message });
    } finally {
      release(slot);
    }
  });
});
server.listen(PORT, () => console.log(`[runner] listening on :${PORT} (concurrency ${CONCURRENCY})`));
