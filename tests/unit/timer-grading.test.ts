import { describe, it, expect } from "vitest";
import { canSubmit, personalDeadline, SUBMIT_GRACE_MS } from "@/lib/timer";
import { computeResult, rank, gradeFor, DEFAULT_POLICY } from "@/lib/grading";
import { parseCsv, toCsv } from "@/lib/csv";
import { quoteMermaidLabels } from "@/lib/mermaid-sanitize";
import { reindentBraces } from "@/components/editor/format";

const start = new Date("2026-11-03T04:30:00Z");
const live = { status: "LIVE" as const, startedAt: start, endsAt: new Date(start.getTime() + 120 * 60_000) };

describe("server-side timer", () => {
  it("personal deadline adds extensions and accommodation", () => {
    expect(personalDeadline(live, 10, 20)!.getTime() - live.endsAt.getTime()).toBe(30 * 60_000);
  });
  it("allows submission before deadline and within grace", () => {
    const d = personalDeadline(live, 0, 0)!;
    expect(canSubmit(live, d, new Date(d.getTime() - 1000), false)).toEqual({ allowed: true, late: false });
    expect(canSubmit(live, d, new Date(d.getTime() + SUBMIT_GRACE_MS - 1), false)).toEqual({ allowed: true, late: false });
  });
  it("rejects after grace unless late allowed (then flagged)", () => {
    const d = personalDeadline(live, 0, 0)!;
    const after = new Date(d.getTime() + SUBMIT_GRACE_MS + 1);
    expect(canSubmit(live, d, after, false).allowed).toBe(false);
    expect(canSubmit(live, d, after, true)).toEqual({ allowed: true, late: true });
  });
  it("rejects before start, after end, and when cancelled", () => {
    expect(canSubmit({ status: "SCHEDULED", startedAt: null, endsAt: null }, null, new Date(), true).allowed).toBe(false);
    expect(canSubmit({ ...live, status: "ENDED" }, live.endsAt, start, true).allowed).toBe(false);
    expect(canSubmit({ ...live, status: "CANCELLED" }, live.endsAt, start, true).allowed).toBe(false);
  });
});

describe("results", () => {
  const base = { studentId: "s", name: "A", required: 4, attendancePercent: 100, projectPercent: 80, vivaPercent: 70 };
  it("missing practicals count as zero in the average", () => {
    const r = computeResult({ ...base, experimentPercents: [100, 100] }, DEFAULT_POLICY);
    expect(r.experimentAvg).toBe(50);
    expect(r.outcome).toBe("INCOMPLETE");
  });
  it("weighted score and grade", () => {
    const r = computeResult({ ...base, experimentPercents: [90, 90, 90, 90] }, DEFAULT_POLICY);
    // 90*.55 + 80*.25 + 70*.10 + 100*.10 = 86.5
    expect(r.weightedScore).toBe(86.5);
    expect(r.grade).toBe("A+");
    expect(r.outcome).toBe("PASS");
  });
  it("low attendance → DETAINED with F", () => {
    const r = computeResult({ ...base, attendancePercent: 60, experimentPercents: [90, 90, 90, 90] }, DEFAULT_POLICY);
    expect(r).toMatchObject({ outcome: "DETAINED", grade: "F" });
  });
  it("below pass mark → FAIL", () => {
    const r = computeResult({ ...base, projectPercent: 10, vivaPercent: 10, experimentPercents: [20, 20, 20, 20] }, DEFAULT_POLICY);
    expect(r.outcome).toBe("FAIL");
  });
  it("grade bands", () => { expect(gradeFor(39.99, DEFAULT_POLICY.bands).grade).toBe("F"); expect(gradeFor(90, DEFAULT_POLICY.bands).grade).toBe("O"); });
  it("competition ranking shares ranks on full ties and applies tie-breaks", () => {
    const rows = [
      { name: "C", weightedScore: 80, experimentAvg: 70 },
      { name: "A", weightedScore: 90, experimentAvg: 80 },
      { name: "B", weightedScore: 80, experimentAvg: 75 },
      { name: "D", weightedScore: 80, experimentAvg: 70 },
      { name: "E", weightedScore: 60, experimentAvg: 90 },
    ];
    const r = rank(rows, ["weightedScore", "experimentAvg"]);
    expect(r.map((x) => [x.name, x.rank])).toEqual([["A", 1], ["B", 2], ["C", 3], ["D", 3], ["E", 5]]);
  });
});

describe("utilities", () => {
  it("CSV round trip with quotes, commas and newlines", () => {
    const csv = toCsv(["a", "b"], [["x, y", 'say "hi"'], ["line1\nline2", 3]]);
    expect(parseCsv(csv)).toEqual([["a", "b"], ["x, y", 'say "hi"'], ["line1\nline2", "3"]]);
  });
  it("CSV export neutralises formula injection", () => expect(toCsv(["a"], [["=1+1"]])).toContain("'=1+1"));
  it("mermaid labels with brackets get quoted", () => {
    expect(quoteMermaidLabels("flowchart TD\n  F{A[mid]==key?} --> G[/Print/]")).toBe('flowchart TD\n  F{"A[mid]==key?"} --> G[/"Print"/]');
  });
  it("re-indenter normalises braces without changing tokens", () => {
    const out = reindentBraces("int main(){\nif(x){\ny();\n}\n}");
    expect(out).toBe("int main(){\n    if(x){\n        y();\n    }\n}\n");
  });
});
