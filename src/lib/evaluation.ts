// Pure assessment logic — no I/O. Unit-tested in tests/evaluation.test.ts.
import type { Verdict } from "@prisma/client";
import type { ExecResult, RunStatus } from "./execution/types";

export type CompareMode = "EXACT" | "TRIM" | "TOKENS" | "FLOAT";

export interface Rubric {
  correctness: number; // auto: proportional to weighted test cases passed
  compilation: number; // auto: compiles and runs without runtime errors
  submission: number; // auto: submitted within the session window
  logic: number; // faculty
  quality: number; // faculty
  efficiency: number; // faculty (execution time is shown to aid judgement)
}
export const AUTO_COMPONENTS = ["correctness", "compilation", "submission"] as const;
export const MANUAL_COMPONENTS = ["logic", "quality", "efficiency"] as const;
export type RubricKey = keyof Rubric;
export const RUBRIC_LABELS: Record<RubricKey, string> = {
  correctness: "Correctness / Test cases",
  logic: "Logic and algorithm",
  quality: "Code quality",
  efficiency: "Efficiency",
  compilation: "Successful compilation & execution",
  submission: "Practical completion / submission",
};
export const DEFAULT_RUBRIC: Rubric = { correctness: 40, logic: 20, quality: 10, efficiency: 10, compilation: 10, submission: 10 };

export const rubricTotal = (r: Rubric) => Object.values(r).reduce((a, b) => a + Number(b || 0), 0);

function normLines(s: string) {
  return s.replace(/\r\n/g, "\n").split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").replace(/\n+$/, "");
}

export function outputsMatch(actual: string, expected: string, mode: CompareMode = "TRIM"): boolean {
  switch (mode) {
    case "EXACT":
      return actual === expected;
    case "TOKENS":
      return actual.trim().split(/\s+/).join(" ") === expected.trim().split(/\s+/).join(" ");
    case "FLOAT": {
      const a = actual.trim().split(/\s+/), e = expected.trim().split(/\s+/);
      if (a.length !== e.length) return false;
      return a.every((tok, i) => {
        const x = Number(tok), y = Number(e[i]);
        if (Number.isFinite(x) && Number.isFinite(y)) return Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(y));
        return tok === e[i];
      });
    }
    default:
      return normLines(actual) === normLines(expected);
  }
}

export interface TestSpec { id: string; input: string; expected: string; weight: number; isHidden: boolean; compareMode: string }
export interface TestOutcome {
  testId: string;
  hidden: boolean;
  passed: boolean;
  status: RunStatus | "WRONG_ANSWER";
  timeMs: number;
  memoryKb: number | null;
  stdout: string;
  stderr: string;
  expected: string;
  input: string;
}

export interface GradeOutcome {
  verdict: Verdict;
  tests: TestOutcome[];
  testsPassed: number;
  testsTotal: number;
  weightPassed: number;
  weightTotal: number;
  maxTimeMs: number | null;
  maxMemoryKb: number | null;
  compileOk: boolean;
  compileOutput: string;
}

const STATUS_VERDICT: Record<string, Verdict> = {
  WRONG_ANSWER: "WRONG_ANSWER",
  RUNTIME_ERROR: "RUNTIME_ERROR",
  TIME_LIMIT_EXCEEDED: "TIME_LIMIT_EXCEEDED",
  MEMORY_LIMIT_EXCEEDED: "MEMORY_LIMIT_EXCEEDED",
  OUTPUT_LIMIT_EXCEEDED: "OUTPUT_LIMIT_EXCEEDED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
};

/** Turn raw execution results + test specs into a graded outcome. */
export function gradeRuns(tests: TestSpec[], exec: ExecResult): GradeOutcome {
  const weightTotal = tests.reduce((a, t) => a + t.weight, 0);
  if (!exec.compile.ok) {
    return { verdict: "COMPILATION_ERROR", tests: [], testsPassed: 0, testsTotal: tests.length, weightPassed: 0, weightTotal, maxTimeMs: null, maxMemoryKb: null, compileOk: false, compileOutput: exec.compile.output };
  }
  const outcomes: TestOutcome[] = tests.map((t, i) => {
    const run = exec.runs[i];
    if (!run) return { testId: t.id, hidden: t.isHidden, passed: false, status: "INTERNAL_ERROR", timeMs: 0, memoryKb: null, stdout: "", stderr: "", expected: t.expected, input: t.input };
    const passed = run.status === "OK" && outputsMatch(run.stdout, t.expected, t.compareMode as CompareMode);
    return { testId: t.id, hidden: t.isHidden, passed, status: run.status === "OK" && !passed ? "WRONG_ANSWER" : run.status, timeMs: run.timeMs, memoryKb: run.memoryKb, stdout: run.stdout, stderr: run.stderr, expected: t.expected, input: t.input };
  });
  const testsPassed = outcomes.filter((o) => o.passed).length;
  const weightPassed = outcomes.reduce((a, o, i) => a + (o.passed ? tests[i].weight : 0), 0);
  let verdict: Verdict;
  if (tests.length === 0) verdict = "MANUAL_REVIEW";
  else if (testsPassed === tests.length) verdict = "ACCEPTED";
  else if (testsPassed > 0) verdict = "PARTIAL";
  else verdict = STATUS_VERDICT[outcomes.find((o) => !o.passed)!.status] ?? "WRONG_ANSWER";
  const times = outcomes.map((o) => o.timeMs);
  const mems = outcomes.map((o) => o.memoryKb).filter((m): m is number => m != null);
  return {
    verdict, tests: outcomes, testsPassed, testsTotal: tests.length, weightPassed, weightTotal,
    maxTimeMs: times.length ? Math.max(...times) : null, maxMemoryKb: mems.length ? Math.max(...mems) : null,
    compileOk: true, compileOutput: exec.compile.output,
  };
}

export type ComponentMarks = Record<RubricKey, number | null>;

/**
 * Automatic rubric components. Subjective components (logic, quality, efficiency) stay null
 * for faculty review — they are never auto-scored.
 * For experiments without automated tests (written / browser-only), correctness is also left to faculty.
 */
export function autoComponentMarks(rubric: Rubric, g: GradeOutcome, opts: { onTime: boolean; hasAutoTests: boolean }): ComponentMarks {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const anyRuntimeFailure = g.tests.some((t) => t.status !== "OK" && t.status !== "WRONG_ANSWER");
  return {
    correctness: opts.hasAutoTests ? r2(g.weightTotal > 0 ? (rubric.correctness * g.weightPassed) / g.weightTotal : 0) : null,
    compilation: opts.hasAutoTests ? (!g.compileOk ? 0 : anyRuntimeFailure ? r2(rubric.compilation / 2) : rubric.compilation) : null,
    submission: opts.onTime ? rubric.submission : r2(rubric.submission / 2),
    logic: null,
    quality: null,
    efficiency: null,
  };
}

export function sumMarks(c: ComponentMarks, keys: readonly RubricKey[]) {
  let total = 0, any = false;
  for (const k of keys) if (c[k] != null) { total += c[k]!; any = true; }
  return { total: Math.round(total * 100) / 100, any };
}

export function totals(c: ComponentMarks) {
  const auto = sumMarks(c, AUTO_COMPONENTS).total;
  const manual = sumMarks(c, MANUAL_COMPONENTS);
  const allManualDone = MANUAL_COMPONENTS.every((k) => c[k] != null) && c.correctness != null && c.compilation != null;
  return { autoMarks: auto, manualMarks: manual.any ? manual.total : null, total: Math.round((auto + manual.total) * 100) / 100, complete: allManualDone };
}

/** Redact hidden test details before sending a result to a student. */
export function redactForStudent(tests: TestOutcome[]) {
  return tests.map((t) => (t.hidden ? { testId: t.testId, hidden: true, passed: t.passed, status: t.status, timeMs: t.timeMs, memoryKb: t.memoryKb } : t));
}
