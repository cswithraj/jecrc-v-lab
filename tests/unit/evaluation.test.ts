import { describe, it, expect } from "vitest";
import { outputsMatch, gradeRuns, autoComponentMarks, totals, redactForStudent, DEFAULT_RUBRIC, rubricTotal } from "@/lib/evaluation";
import type { ExecResult } from "@/lib/execution/types";

const tests = [
  { id: "a", input: "1", expected: "1", weight: 1, isHidden: false, compareMode: "TRIM" },
  { id: "b", input: "2", expected: "4", weight: 2, isHidden: true, compareMode: "TRIM" },
  { id: "c", input: "3", expected: "9", weight: 2, isHidden: true, compareMode: "TRIM" },
];
const run = (stdout: string, status: ExecResult["runs"][0]["status"] = "OK") => ({ status, stdout, stderr: "", timeMs: 5, memoryKb: 1000 });

describe("output comparison", () => {
  it("TRIM ignores trailing whitespace and final newlines", () => {
    expect(outputsMatch("a  \nb\n\n", "a\nb", "TRIM")).toBe(true);
    expect(outputsMatch(" a\nb", "a\nb", "TRIM")).toBe(false);
  });
  it("EXACT is strict", () => expect(outputsMatch("a\n", "a", "EXACT")).toBe(false));
  it("TOKENS ignores all whitespace layout", () => expect(outputsMatch("1  2\n3", "1 2 3", "TOKENS")).toBe(true));
  it("FLOAT tolerates 1e-6 relative error", () => {
    expect(outputsMatch("0.3333333", "0.33333334", "FLOAT")).toBe(true);
    expect(outputsMatch("0.334", "0.333", "FLOAT")).toBe(false);
  });
  it("handles CRLF", () => expect(outputsMatch("x\r\ny\r\n", "x\ny", "TRIM")).toBe(true));
});

describe("grading", () => {
  it("all pass → ACCEPTED with full auto marks", () => {
    const g = gradeRuns(tests, { compile: { ok: true, output: "" }, runs: [run("1\n"), run("4\n"), run("9\n")] });
    expect(g.verdict).toBe("ACCEPTED");
    const c = autoComponentMarks(DEFAULT_RUBRIC, g, { onTime: true, hasAutoTests: true });
    expect(c).toMatchObject({ correctness: 40, compilation: 10, submission: 10, logic: null, quality: null, efficiency: null });
    expect(totals(c)).toMatchObject({ autoMarks: 60, manualMarks: null, total: 60, complete: false });
  });
  it("weighted partial credit", () => {
    const g = gradeRuns(tests, { compile: { ok: true, output: "" }, runs: [run("1"), run("4"), run("8")] });
    expect(g.verdict).toBe("PARTIAL");
    expect(g.weightPassed).toBe(3);
    expect(autoComponentMarks(DEFAULT_RUBRIC, g, { onTime: true, hasAutoTests: true }).correctness).toBe(24);
  });
  it("compile error → zero correctness and compilation", () => {
    const g = gradeRuns(tests, { compile: { ok: false, output: "error" }, runs: [] });
    expect(g.verdict).toBe("COMPILATION_ERROR");
    expect(autoComponentMarks(DEFAULT_RUBRIC, g, { onTime: true, hasAutoTests: true })).toMatchObject({ correctness: 0, compilation: 0 });
  });
  it("runtime errors halve compilation marks; TLE verdict when nothing passes", () => {
    const g = gradeRuns(tests, { compile: { ok: true, output: "" }, runs: [run("", "TIME_LIMIT_EXCEEDED"), run("", "RUNTIME_ERROR"), run("1")] });
    expect(g.verdict).toBe("TIME_LIMIT_EXCEEDED");
    expect(autoComponentMarks(DEFAULT_RUBRIC, g, { onTime: true, hasAutoTests: true }).compilation).toBe(5);
  });
  it("late submission gets half submission marks", () => {
    const g = gradeRuns(tests, { compile: { ok: true, output: "" }, runs: [run("1"), run("4"), run("9")] });
    expect(autoComponentMarks(DEFAULT_RUBRIC, g, { onTime: false, hasAutoTests: true }).submission).toBe(5);
  });
  it("hidden test details are redacted", () => {
    const g = gradeRuns(tests, { compile: { ok: true, output: "" }, runs: [run("1"), run("4"), run("9")] });
    const r = redactForStudent(g.tests);
    expect(r[1]).not.toHaveProperty("input");
    expect(r[1]).not.toHaveProperty("expected");
    expect(r[0]).toHaveProperty("input");
  });
  it("default rubric totals 100", () => expect(rubricTotal(DEFAULT_RUBRIC)).toBe(100));
  it("complete only when every faculty component is entered", () => {
    expect(totals({ correctness: 40, compilation: 10, submission: 10, logic: 15, quality: 8, efficiency: 7 })).toMatchObject({ total: 90, complete: true });
  });
});
