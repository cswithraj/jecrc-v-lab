import "server-only";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { ApiError, forbidden } from "@/lib/api";
import { canManageOffering } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { notifyOffering } from "@/lib/notify";
import { computeResult, rank, DEFAULT_POLICY, type Policy, type ComputedResult } from "@/lib/grading";
import { pct } from "@/lib/utils";

export async function activePolicy(): Promise<Policy & { id: string | null; name: string }> {
  const row = await prisma.gradingPolicy.findFirst({ where: { isDefault: true } });
  if (!row) return { ...DEFAULT_POLICY, id: null, name: "Built-in default" };
  return {
    id: row.id, name: row.name,
    weights: { ...DEFAULT_POLICY.weights, ...(row.weights as object) },
    bands: (row.bands as unknown as Policy["bands"]) ?? DEFAULT_POLICY.bands,
    passPercent: row.passPercent, minAttendancePercent: row.minAttendancePercent,
    tieBreak: row.tieBreak.length ? row.tieBreak : DEFAULT_POLICY.tieBreak,
  };
}

/**
 * Gather each enrolled student's inputs for one class.
 * - Experiments: best evaluated submission per practical session, as % of max (missing = 0 via `required`).
 * - Attendance: PRESENT/LATE over ENDED sessions.
 * - Project: team marks as % of project max. Viva: enrollment viva marks (out of 100).
 */
export async function gatherInputs(offeringId: string) {
  const o = await prisma.subjectOffering.findUniqueOrThrow({
    where: { id: offeringId },
    include: {
      subject: { select: { requiredExperiments: true } },
      enrollments: { where: { status: "ACTIVE" }, include: { student: { select: { id: true, name: true, enrollmentNo: true } } } },
      sessions: { select: { id: true, status: true } },
      teams: { include: { members: true, project: { select: { maxMarks: true } } } },
    },
  });
  const required = o.requiredExperiments ?? o.subject.requiredExperiments;
  const sessionIds = o.sessions.map((s) => s.id);
  const ended = new Set(o.sessions.filter((s) => s.status === "ENDED").map((s) => s.id));
  const [subs, att] = await Promise.all([
    prisma.submission.findMany({ where: { sessionId: { in: sessionIds }, status: { not: "REOPENED" } }, select: { studentId: true, sessionId: true, evaluation: { select: { totalMarks: true, maxMarks: true, manualMarks: true } } } }),
    prisma.attendance.findMany({ where: { sessionId: { in: [...ended] } }, select: { studentId: true, status: true } }),
  ]);
  const pendingManual = subs.filter((s) => s.evaluation && s.evaluation.manualMarks == null).length;
  const teamOf = new Map<string, { marks: number | null; max: number }>();
  for (const t of o.teams) for (const m of t.members) teamOf.set(m.studentId, { marks: t.marks, max: t.project.maxMarks });

  const inputs = o.enrollments.map((e) => {
    const mine = subs.filter((s) => s.studentId === e.studentId && s.evaluation);
    const present = att.filter((a) => a.studentId === e.studentId && (a.status === "PRESENT" || a.status === "LATE")).length;
    const team = teamOf.get(e.studentId);
    return {
      studentId: e.studentId, name: e.student.name, enrollmentNo: e.student.enrollmentNo,
      experimentPercents: mine.map((s) => (s.evaluation!.totalMarks / s.evaluation!.maxMarks) * 100),
      required,
      attendancePercent: ended.size ? pct(present, ended.size) : 100,
      projectPercent: team?.marks == null ? null : (team.marks / team.max) * 100,
      vivaPercent: e.vivaMarks,
    };
  });
  return { offering: o, inputs, required, sessionsHeld: ended.size, pendingManual };
}

export type ResultRow = ComputedResult & { enrollmentNo: string | null; rank: number };

/** Compute (but do not store) results for a class, ranked. */
export async function previewResults(offeringId: string) {
  const policy = await activePolicy();
  const g = await gatherInputs(offeringId);
  const enr = new Map(g.inputs.map((i) => [i.studentId, i.enrollmentNo]));
  const rows = rank(g.inputs.map((i) => computeResult(i, policy)), policy.tieBreak).map((r) => ({ ...r, enrollmentNo: enr.get(r.studentId) ?? null })) as ResultRow[];
  return { policy, rows, required: g.required, sessionsHeld: g.sessionsHeld, pendingManual: g.pendingManual, finalized: g.offering.resultsFinalized };
}

async function assertManage(user: SessionUser, offeringId: string) {
  if (!(await canManageOffering(user, offeringId))) throw forbidden();
}

/** Recompute and store DRAFT results. Refused once finalized. */
export async function computeAndStore(user: SessionUser, offeringId: string) {
  await assertManage(user, offeringId);
  const p = await previewResults(offeringId);
  if (p.finalized) throw new ApiError(409, "Results for this class are finalized. An administrator must unlock them before recomputing.");
  await prisma.$transaction(async (tx) => {
    await tx.finalResult.deleteMany({ where: { offeringId, studentId: { notIn: p.rows.map((r) => r.studentId) } } });
    for (const r of p.rows) {
      const data = {
        experimentsDone: r.experimentsDone, experimentsRequired: r.experimentsRequired, experimentTotal: r.experimentTotal, experimentAvg: r.experimentAvg,
        attendancePercent: r.attendancePercent, projectMarks: r.projectMarks, vivaMarks: r.vivaMarks, weightedScore: r.weightedScore,
        grade: r.grade, gradePoints: r.gradePoints, outcome: r.outcome, rank: r.rank, status: "DRAFT" as const, policyId: p.policy.id, computedAt: new Date(),
      };
      await tx.finalResult.upsert({ where: { offeringId_studentId: { offeringId, studentId: r.studentId } }, create: { offeringId, studentId: r.studentId, ...data }, update: data });
    }
    await audit({ actorId: user.id, action: "results.compute", entityType: "SubjectOffering", entityId: offeringId, after: { students: p.rows.length, policy: p.policy.name, pendingManual: p.pendingManual } }, tx);
  });
  return p;
}

export async function finalizeResults(user: SessionUser, offeringId: string) {
  await assertManage(user, offeringId);
  const o = await prisma.subjectOffering.findUniqueOrThrow({ where: { id: offeringId }, select: { resultsFinalized: true, subject: { select: { name: true } }, _count: { select: { results: true, enrollments: true } } } });
  if (o.resultsFinalized) throw new ApiError(409, "Results are already finalized.");
  if (o._count.results === 0) throw new ApiError(400, "Compute the results before finalizing.");
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.finalResult.updateMany({ where: { offeringId }, data: { status: "FINALIZED", finalizedById: user.id, finalizedAt: now } });
    await tx.subjectOffering.update({ where: { id: offeringId }, data: { resultsFinalized: true } });
    await audit({ actorId: user.id, action: "results.finalize", entityType: "SubjectOffering", entityId: offeringId }, tx);
  });
  await notifyOffering(offeringId, { type: "RESULT_PUBLISHED", title: "Final result published", body: `Your final result for ${o.subject.name} is available.`, link: "/results" });
}

/** Unlock finalized results (administrators only, reason required, audited). */
export async function unlockResults(user: SessionUser, offeringId: string, reason: string) {
  if (user.role !== "SUPER_ADMIN" && user.role !== "HOD") throw forbidden("Only an administrator or HOD can unlock finalized results.");
  await assertManage(user, offeringId);
  await prisma.$transaction(async (tx) => {
    await tx.finalResult.updateMany({ where: { offeringId }, data: { status: "DRAFT", finalizedById: null, finalizedAt: null } });
    await tx.subjectOffering.update({ where: { id: offeringId }, data: { resultsFinalized: false } });
    await audit({ actorId: user.id, action: "results.unlock", entityType: "SubjectOffering", entityId: offeringId, reason }, tx);
  });
}

/** Stored results for a class (staff) — ordered by rank. */
export async function storedResults(offeringId: string) {
  return prisma.finalResult.findMany({ where: { offeringId }, orderBy: [{ rank: "asc" }, { student: { name: "asc" } }], include: { student: { select: { name: true, enrollmentNo: true } } } });
}

export const RESULT_COLUMNS = [
  ["rank", "Rank", "Rank"], ["enrollmentNo", "Enrollment no.", "Enrollment no."], ["name", "Student", "Student"], ["experimentsDone", "Practicals done", "Done"], ["experimentsRequired", "Required", "Req."],
  ["experimentAvg", "Practical avg %", "Prac. %"], ["attendancePercent", "Attendance %", "Attend. %"], ["projectMarks", "Project %", "Project %"], ["vivaMarks", "Viva %", "Viva %"],
  ["weightedScore", "Final score", "Score"], ["grade", "Grade", "Grade"], ["gradePoints", "Grade points", "GP"], ["outcome", "Outcome", "Outcome"],
] as const;

export async function exportRows(offeringId: string) {
  const rows = await storedResults(offeringId);
  return rows.map((r) => ({ ...r, name: r.student.name, enrollmentNo: r.student.enrollmentNo ?? "" }));
}
