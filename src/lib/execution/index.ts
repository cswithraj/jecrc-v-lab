import type { ExecutionProvider } from "./types";
import { runnerProvider } from "./runner";
import { judge0Provider } from "./judge0";

const PROVIDERS: Record<string, ExecutionProvider> = { runner: runnerProvider, judge0: judge0Provider };

export function getExecutionProvider(): ExecutionProvider {
  return PROVIDERS[process.env.EXECUTION_PROVIDER || "runner"] ?? runnerProvider;
}
export * from "./types";
