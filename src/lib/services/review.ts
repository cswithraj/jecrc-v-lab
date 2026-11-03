import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, badRequest, forbidden, notFound } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { canManageSubject, canManageOffering } from "@/lib/rbac";
import { DEFAULT_RUBRIC, totals, redactForStudent, type Rubric, type RubricKey, type ComponentMarks, type TestOutcome } from "@/lib/evaluation";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

export async function loadSubmission(user: SessionUser, id: string) {
  const sub = await prisma.submission.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, name: true, enrollmentNo: true } },
      experiment: { select: { id: true, title: true, code: true, number: true, rubric: true, maxMarks: true, subjectId: true, referenceCode: true, language: true } },
      session: { select: { id: true, sequence: true, offeringId: true, marksReleaseAt: true, endsAt: true } },
      evaluation: { include: { overrides: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" } } } },
      feedback: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      attempts: { where: { kind: "SUBMIT" }, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true, verdict: true, testsPassed: true, testsTotal: true, code: true, details: true, compileOutput: true } },
    },
  });
  if (!sub) throw notFound("Submission not found.");
  if (user.role === "STUDENT") {
    if (sub.studentId !== user.id) throw notFound("Submission not found.");
  } else {
    const ok = sub.session ? await canManageOffering(user, sub.session.offeringId) : await canManageSubject(user, sub.experiment.subjectId);
    if (!ok) throw forbidden();
  }
  return sub;
}

/** Student view: marks only after release, hidden tests redacted, no reference code. */
export function studentView(sub: Awaited<ReturnType<typeof loadSubmission>>) {
  const released = !sub.session || (sub.session.marksReleaseAt != null && sub.session.marksReleaseAt <= new Date());
  const { experiment, evaluation, attempts, ...rest } = sub;
  return {
    ...rest,
    experiment: { id: experiment.id, title: experiment.title, code: experiment.code, number: experiment.number },
    marksReleased: released,
    evaluation: evaluation ? { verdict: evaluation.verdict, testsPassed: evaluation.testsPassed, testsTotal: evaluation.testsTotal, timeMs: evaluation.timeMs, memoryKb: evaluation.memoryKb, components: released ? evaluation.components : null, totalMarks: released ? evaluation.totalMarks : null, maxMarks: evaluation.maxMarks } : null,
    attempts: attempts.map((a) => ({ ...a, details: redactForStudent((a.details ?? []) as unknown as TestOutcome[]) })),
  };
}

/**
 * Faculty marks entry. First-time entry of a pending (null) component needs no reason; changing any
 * value that already exists (automatic or faculty) is an override: reason required, MarkOverride + audit row.
 */
export async function updateMarks(user: SessionUser, id: string, input: { components: Partial<Record<RubricKey, number>>; reason?: string; ip?: string | null }) {
  const sub = await loadSubmission(user, id);
  if (!sub.evaluation) throw badRequest("This submission has not been evaluated yet.");
  if (sub.status === "FINALIZED" && user.role === "FACULTY") throw forbidden("Finalized marks can only be changed by HOD or administrators.");
  const rubric = { ...DEFAULT_RUBRIC, ...(sub.experiment.rubric as Partial<Rubric>) };
  const current = sub.evaluation.components as unknown as ComponentMarks;
  const next: ComponentMarks = { ...current };
  const overrides: { component: string; oldValue: number | null; newValue: number }[] = [];
  for (const [k, v] of Object.entries(input.components) as [RubricKey, number][]) {
    if (!(k in rubric)) throw badRequest(`Unknown rubric component "${k}".`);
    if (v < 0 || v > rubric[k]) throw badRequest(`${k} must be between 0 and ${rubric[k]}.`);
    const old = current[k];
    if (old === v) continue;
    if (old != null) overrides.push({ component: k, oldValue: old, newValue: v });
    next[k] = Math.round(v * 100) / 100;
  }
  if (overrides.length && (!input.reason || input.reason.trim().length < 5)) throw new ApiError(422, "A reason (at least 5 characters) is required to change existing marks.");
  const t = totals(next);
  const updated = await prisma.$transaction(async (tx) => {
    const ev = await tx.evaluationResult.update({ where: { id: sub.evaluation!.id }, data: { components: next as unknown as Prisma.InputJsonValue, autoMarks: t.autoMarks, manualMarks: t.manualMarks, totalMarks: t.total, reviewedById: user.id, reviewedAt: new Date() } });
    for (const o of overrides) await tx.markOverride.create({ data: { evaluationId: ev.id, ...o, reason: input.reason!.trim(), actorId: user.id } });
    await audit({ actorId: user.id, action: overrides.length ? "MARKS_OVERRIDE" : "MARKS_ENTRY", entityType: "Submission", entityId: sub.id, before: current, after: next, reason: input.reason ?? null, ip: input.ip }, tx);
    return ev;
  });
  return { evaluation: updated, complete: t.complete, overrides: overrides.length };
}

export async function addFeedback(user: SessionUser, id: string, comment: string) {
  const sub = await loadSubmission(user, id);
  const f = await prisma.facultyFeedback.create({ data: { submissionId: sub.id, authorId: user.id, comment } });
  await notify([sub.studentId], { type: "MARKS_RELEASED", title: "New feedback on your submission", body: `${sub.experiment.title}: ${comment.slice(0, 120)}`, link: `/experiments/${sub.experiment.id}#result` });
  return f;
}

export async function finalizeSubmission(user: SessionUser, id: string) {
  const sub = await loadSubmission(user, id);
  const comps = sub.evaluation?.components as unknown as ComponentMarks | undefined;
  if (!comps || !totals(comps).complete) throw badRequest("Enter all faculty-assessed components (logic, code quality, efficiency, and correctness where pending) before finalizing.");
  const u = await prisma.submission.update({ where: { id }, data: { status: "FINALIZED" } });
  await audit({ actorId: user.id, action: "SUBMISSION_FINALIZE", entityType: "Submission", entityId: id });
  return u;
}

export async function releaseMarks(user: SessionUser, sessionId: string) {
  const s = await prisma.practicalSession.findUnique({ where: { id: sessionId }, include: { offering: { include: { subject: true } }, experiment: { select: { title: true } } } });
  if (!s) throw notFound();
  if (!(await canManageOffering(user, s.offeringId))) throw forbidden();
  const now = new Date();
  const u = await prisma.practicalSession.update({ where: { id: sessionId }, data: { marksReleaseAt: now } });
  const subs = await prisma.submission.findMany({ where: { sessionId }, select: { studentId: true } });
  await notify(subs.map((x) => x.studentId), { type: "MARKS_RELEASED", title: `Marks released: ${s.offering.subject.shortName} practical #${s.sequence}`, body: `Your marks for "${s.experiment.title}" are available.`, link: "/student" });
  await audit({ actorId: user.id, action: "MARKS_RELEASE", entityType: "PracticalSession", entityId: sessionId, after: { marksReleaseAt: now } });
  return u;
}
