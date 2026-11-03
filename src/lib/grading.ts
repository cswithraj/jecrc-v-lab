// Final result computation & ranking — pure functions, configurable by GradingPolicy.

export interface GradeBand { grade: string; min: number; points: number }
export interface PolicyWeights { experiments: number; project: number; viva: number; attendance: number }
export interface Policy {
  weights: PolicyWeights;
  bands: GradeBand[];
  passPercent: number;
  minAttendancePercent: number;
  tieBreak: string[];
}

export const DEFAULT_POLICY: Policy = {
  weights: { experiments: 55, project: 25, viva: 10, attendance: 10 },
  bands: [
    { grade: "O", min: 90, points: 10 },
    { grade: "A+", min: 80, points: 9 },
    { grade: "A", min: 70, points: 8 },
    { grade: "B+", min: 60, points: 7 },
    { grade: "B", min: 50, points: 6 },
    { grade: "C", min: 45, points: 5 },
    { grade: "P", min: 40, points: 4 },
    { grade: "F", min: 0, points: 0 },
  ],
  passPercent: 40,
  minAttendancePercent: 75,
  tieBreak: ["weightedScore", "experimentAvg", "projectMarks", "attendancePercent"],
};

export interface StudentInputs {
  studentId: string;
  name: string;
  experimentPercents: number[]; // each graded experiment as % of its max marks
  required: number;
  attendancePercent: number;
  projectPercent: number | null;
  vivaPercent: number | null;
}

export interface ComputedResult {
  studentId: string;
  name: string;
  experimentsDone: number;
  experimentsRequired: number;
  experimentTotal: number; // sum of percents
  experimentAvg: number; // average over REQUIRED experiments (missing = 0)
  attendancePercent: number;
  projectMarks: number | null;
  vivaMarks: number | null;
  weightedScore: number;
  grade: string;
  gradePoints: number;
  outcome: "PASS" | "FAIL" | "INCOMPLETE" | "DETAINED";
  rank?: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function gradeFor(score: number, bands: GradeBand[]) {
  const sorted = [...bands].sort((a, b) => b.min - a.min);
  return sorted.find((b) => score >= b.min) ?? sorted[sorted.length - 1];
}

export function computeResult(s: StudentInputs, p: Policy): ComputedResult {
  const done = s.experimentPercents.length;
  const total = s.experimentPercents.reduce((a, b) => a + b, 0);
  const avg = s.required > 0 ? total / Math.max(s.required, done) : 0;
  const w = p.weights;
  const wSum = w.experiments + w.project + w.viva + w.attendance || 1;
  const score = (avg * w.experiments + (s.projectPercent ?? 0) * w.project + (s.vivaPercent ?? 0) * w.viva + s.attendancePercent * w.attendance) / wSum;
  const band = gradeFor(score, p.bands);
  let outcome: ComputedResult["outcome"] = score >= p.passPercent ? "PASS" : "FAIL";
  if (s.attendancePercent < p.minAttendancePercent) outcome = "DETAINED";
  else if (done < s.required || s.projectPercent == null) outcome = outcome === "PASS" ? "INCOMPLETE" : outcome;
  const failing = outcome === "FAIL" || outcome === "DETAINED";
  return {
    studentId: s.studentId, name: s.name,
    experimentsDone: done, experimentsRequired: s.required,
    experimentTotal: r2(total), experimentAvg: r2(avg), attendancePercent: r2(s.attendancePercent),
    projectMarks: s.projectPercent == null ? null : r2(s.projectPercent), vivaMarks: s.vivaPercent == null ? null : r2(s.vivaPercent),
    weightedScore: r2(score),
    grade: failing ? "F" : band.grade, gradePoints: failing ? 0 : band.points, outcome,
  };
}

/**
 * Competition ranking ("1-2-2-4"): sort by the tie-break keys (all descending);
 * students equal on every key share a rank. Order within a tie is alphabetical for display only.
 */
export function rank<T extends { name: string }>(rows: T[], tieBreak: string[]): (T & { rank: number })[] {
  const val = (r: T, k: string) => Number((r as Record<string, unknown>)[k] ?? -1);
  const cmp = (a: T, b: T) => {
    for (const k of tieBreak) { const d = val(b, k) - val(a, k); if (Math.abs(d) > 1e-9) return d; }
    return 0;
  };
  const sorted = [...rows].sort((a, b) => cmp(a, b) || a.name.localeCompare(b.name));
  let lastRank = 0;
  return sorted.map((r, i) => {
    const rk = i > 0 && cmp(sorted[i - 1], r) === 0 ? lastRank : i + 1;
    lastRank = rk;
    return { ...r, rank: rk };
  });
}
