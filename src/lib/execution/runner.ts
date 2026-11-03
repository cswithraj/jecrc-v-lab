import type { ExecRequest, ExecResult, ExecutionProvider } from "./types";
import { ExecutionUnavailableError } from "./types";

/** JECRC sandbox runner (services/runner) over HTTP with a shared secret. */
export const runnerProvider: ExecutionProvider = {
  name: "runner",
  async execute(req: ExecRequest): Promise<ExecResult> {
    const url = process.env.RUNNER_URL;
    const secret = process.env.RUNNER_SECRET;
    if (!url || !secret) throw new ExecutionUnavailableError("Execution service is not configured (RUNNER_URL / RUNNER_SECRET).");
    let res: Response;
    try {
      res = await fetch(`${url}/execute`, {
        method: "POST",
        headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
        body: JSON.stringify({ language: req.language, source: req.source, inputs: req.inputs, timeLimitMs: req.timeLimitMs, memoryLimitKb: req.memoryLimitKb }),
        signal: AbortSignal.timeout(120_000),
        cache: "no-store",
      });
    } catch {
      throw new ExecutionUnavailableError("Execution service is unreachable. Please try again shortly.");
    }
    if (res.status === 429) throw new ExecutionUnavailableError("Execution service is busy. Please retry in a few seconds.");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Runner error ${res.status}`);
    return {
      compile: { ok: body.compile.ok, output: body.compile.output },
      runs: body.runs.map((r: { status: ExecResult["runs"][0]["status"]; stdout: string; stderr: string; timeMs: number; memoryKb: number | null }) => ({ status: r.status, stdout: r.stdout, stderr: r.stderr, timeMs: r.timeMs, memoryKb: r.memoryKb })),
    };
  },
};
