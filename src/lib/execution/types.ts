import type { Language } from "@prisma/client";

export type RunStatus = "OK" | "RUNTIME_ERROR" | "TIME_LIMIT_EXCEEDED" | "MEMORY_LIMIT_EXCEEDED" | "OUTPUT_LIMIT_EXCEEDED" | "INTERNAL_ERROR";

export interface ExecRequest {
  language: Language;
  source: string;
  inputs: string[];
  timeLimitMs: number;
  memoryLimitKb: number;
}
export interface ExecRun {
  status: RunStatus;
  stdout: string;
  stderr: string;
  timeMs: number;
  memoryKb: number | null;
}
export interface ExecResult {
  compile: { ok: boolean; output: string };
  runs: ExecRun[];
}
/** Pluggable execution backend. Implementations MUST execute code outside the web-app process. */
export interface ExecutionProvider {
  name: string;
  execute(req: ExecRequest): Promise<ExecResult>;
}
export class ExecutionUnavailableError extends Error {}
