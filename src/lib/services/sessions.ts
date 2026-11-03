import "server-only";
import { prisma } from "@/lib/db";
import { ApiError, forbidden, notFound } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { canManageOffering } from "@/lib/rbac";
import { personalDeadline, remainingMs, SUBMIT_GRACE_MS } from "@/lib/timer";
import { audit } from "@/lib/audit";
import { notify, notifyOffering } from "@/lib/notify";

const LATE_AFTER_MIN = 15;

export async function loadSessionForStaff(user: SessionUser, id: string) {
  const s = await prisma.practicalSession.findUnique({ where: { id }, include: { offering: { include: { subject: true, batch: true } }, experiment: { select: { id: true, title: true, number: true, code: true } } } });
  if (!s) throw notFound("Practical session not found.");
  if (!(await canManageOffering(user, s.offeringId))) throw forbidden();
  return s;
}

/** Student-facing status, computed entirely from server time. */
export async function studentSessionStatus(user: SessionUser, id: string) {
  const s = await prisma.practicalSession.findUnique({ where: { id }, include: { extensions: { where: { studentId: user.id } } } });
  if (!s) throw notFound("Practical session not found.");
  const enrolled = await prisma.studentEnrollment.findUnique({ where: { offeringId_studentId: { offeringId: s.offeringId, studentId: user.id } } });
  if (!enrolled) throw forbidden("You are not enrolled in this class.");
  const ext = s.extensions.reduce((a, e) => a + e.minutes, 0);
  const deadline = personalDeadline(s, ext, user.extraTimeMinutes);
  const now = new Date();
  const sub = await prisma.submission.findUnique({ where: { studentId_sessionId: { studentId: user.id, sessionId: s.id } }, select: { id: true, submittedAt: true, status: true, isLate: true } });
  const open = s.status === "LIVE" && !!deadline && now.getTime() <= deadline.getTime() + SUBMIT_GRACE_MS;
  return {
    status: s.status, serverNow: now.toISOString(), startedAt: s.startedAt, deadline, extensionMinutes: ext, extraTimeMinutes: user.extraTimeMinutes,
    remainingMs: s.status === "LIVE" ? remainingMs(deadline, now) : 0, open: open || (s.status === "LIVE" && s.allowLate), allowLate: s.allowLate,
    submission: sub, canSubmit: sub?.status === "REOPENED" || (!sub && (open || (s.status === "LIVE" && s.allowLate))),
  };
}

/** Student opens a live session → attendance (PRESENT, or LATE after 15 minutes). */
export async function joinSession(user: SessionUser, id: string) {
  const st = await studentSessionStatus(user, id);
  if (st.status !== "LIVE") return st;
  const s = await prisma.practicalSession.findUniqueOrThrow({ where: { id } });
  const late = s.startedAt && Date.now() - s.startedAt.getTime() > LATE_AFTER_MIN * 60_000;
  await prisma.attendance.upsert({ where: { sessionId_studentId: { sessionId: id, studentId: user.id } }, update: {}, create: { sessionId: id, studentId: user.id, status: late ? "LATE" : "PRESENT", source: "AUTO" } });
  return st;
}

export async function startSession(user: SessionUser, id: string) {
  const s = await loadSessionForStaff(user, id);
  if (s.status !== "SCHEDULED") throw new ApiError(409, `Session is already ${s.status.toLowerCase()}.`);
  const live = await prisma.practicalSession.findFirst({ where: { offeringId: s.offeringId, status: "LIVE" } });
  if (live) throw new ApiError(409, `Practical #${live.sequence} is still live for this class. End it first.`);
  const now = new Date();
  const updated = await prisma.practicalSession.update({ where: { id }, data: { status: "LIVE", startedAt: now, endsAt: new Date(now.getTime() + s.durationMin * 60_000), conductedById: user.id } });
  await audit({ actorId: user.id, action: "SESSION_START", entityType: "PracticalSession", entityId: id, after: { startedAt: now, durationMin: s.durationMin } });
  await notifyOffering(s.offeringId, { type: "ASSIGNMENT", title: `${s.offering.subject.shortName} practical #${s.sequence} has started`, body: `${s.experiment.title} — ${s.durationMin} minutes.`, link: `/practicals/${id}` });
  return updated;
}

export async function endSession(user: SessionUser, id: string) {
  const s = await loadSessionForStaff(user, id);
  if (s.status !== "LIVE") throw new ApiError(409, "Only a live session can be ended.");
  const now = new Date();
  const updated = await prisma.practicalSession.update({ where: { id }, data: { status: "ENDED", endedAt: now, endsAt: s.endsAt && s.endsAt < now ? s.endsAt : now } });
  // Absentees: enrolled students with no attendance record
  const enrolled = await prisma.studentEnrollment.findMany({ where: { offeringId: s.offeringId, status: "ACTIVE" }, select: { studentId: true } });
  const marked = new Set((await prisma.attendance.findMany({ where: { sessionId: id }, select: { studentId: true } })).map((a) => a.studentId));
  const absent = enrolled.map((e) => e.studentId).filter((sid) => !marked.has(sid));
  if (absent.length) {
    await prisma.attendance.createMany({ data: absent.map((studentId) => ({ sessionId: id, studentId, status: "ABSENT" as const, source: "AUTO" })) });
    await notify(absent, { type: "MISSED_SESSION", title: `Missed practical: ${s.offering.subject.shortName} #${s.sequence}`, body: `You were marked absent for "${s.experiment.title}". Contact your faculty if this is incorrect.`, link: "/student" });
  }
  await audit({ actorId: user.id, action: "SESSION_END", entityType: "PracticalSession", entityId: id, after: { endedAt: now, absent: absent.length } });
  return updated;
}

/** Extension for one student, or for everyone (studentId omitted → moves the session end). */
export async function extendSession(user: SessionUser, id: string, input: { studentId?: string; minutes: number; reason: string }) {
  const s = await loadSessionForStaff(user, id);
  if (s.status === "CANCELLED") throw new ApiError(409, "Session is cancelled.");
  if (input.studentId) {
    const en = await prisma.studentEnrollment.findUnique({ where: { offeringId_studentId: { offeringId: s.offeringId, studentId: input.studentId } } });
    if (!en) throw new ApiError(400, "Student is not enrolled in this class.");
    const e = await prisma.sessionExtension.create({ data: { sessionId: id, studentId: input.studentId, minutes: input.minutes, reason: input.reason, grantedById: user.id } });
    await audit({ actorId: user.id, action: "SESSION_EXTEND_STUDENT", entityType: "PracticalSession", entityId: id, after: { studentId: input.studentId, minutes: input.minutes }, reason: input.reason });
    await notify([input.studentId], { type: "DEADLINE", title: "Extra time granted", body: `You have ${input.minutes} extra minutes for practical #${s.sequence}.`, link: `/practicals/${id}` });
    return e;
  }
  if (s.status !== "LIVE" || !s.endsAt) {
    const updated = await prisma.practicalSession.update({ where: { id }, data: { durationMin: s.durationMin + input.minutes } });
    await audit({ actorId: user.id, action: "SESSION_EXTEND_ALL", entityType: "PracticalSession", entityId: id, before: { durationMin: s.durationMin }, after: { durationMin: updated.durationMin }, reason: input.reason });
    return updated;
  }
  const updated = await prisma.practicalSession.update({ where: { id }, data: { endsAt: new Date(s.endsAt.getTime() + input.minutes * 60_000), durationMin: s.durationMin + input.minutes } });
  await audit({ actorId: user.id, action: "SESSION_EXTEND_ALL", entityType: "PracticalSession", entityId: id, before: { endsAt: s.endsAt }, after: { endsAt: updated.endsAt }, reason: input.reason });
  await notifyOffering(s.offeringId, { type: "DEADLINE", title: "Practical extended", body: `Practical #${s.sequence} extended by ${input.minutes} minutes.`, link: `/practicals/${id}` });
  return updated;
}

/** Reopen a student's submission so they can resubmit (original attempt stays in history). */
export async function reopenSubmission(user: SessionUser, id: string, input: { studentId: string; reason: string }) {
  const s = await loadSessionForStaff(user, id);
  const sub = await prisma.submission.findUnique({ where: { studentId_sessionId: { studentId: input.studentId, sessionId: s.id } } });
  if (!sub) throw notFound("No submission to reopen for this student.");
  if (sub.status === "FINALIZED" && user.role === "FACULTY") throw forbidden("Finalized submissions can only be reopened by HOD or administrators.");
  const updated = await prisma.submission.update({ where: { id: sub.id }, data: { status: "REOPENED", reopenCount: { increment: 1 } } });
  await audit({ actorId: user.id, action: "SUBMISSION_REOPEN", entityType: "Submission", entityId: sub.id, before: { status: sub.status }, after: { status: "REOPENED" }, reason: input.reason });
  await notify([input.studentId], { type: "DEADLINE", title: "Submission reopened", body: `Your submission for practical #${s.sequence} was reopened: ${input.reason}`, link: `/practicals/${id}` });
  return updated;
}

/** Live monitoring board for faculty. */
export async function monitor(user: SessionUser, id: string) {
  const s = await loadSessionForStaff(user, id);
  const [enrolled, attendance, subs, drafts, extensions, attempts] = await Promise.all([
    prisma.studentEnrollment.findMany({ where: { offeringId: s.offeringId, status: "ACTIVE" }, include: { student: { select: { id: true, name: true, enrollmentNo: true, extraTimeMinutes: true } } }, orderBy: { student: { name: "asc" } } }),
    prisma.attendance.findMany({ where: { sessionId: id } }),
    prisma.submission.findMany({ where: { sessionId: id }, include: { evaluation: { select: { verdict: true, testsPassed: true, testsTotal: true, totalMarks: true, autoMarks: true, manualMarks: true } } } }),
    prisma.codeDraft.findMany({ where: { experimentId: s.experimentId, updatedAt: { gte: s.startedAt ?? new Date(0) } }, select: { studentId: true, updatedAt: true } }),
    prisma.sessionExtension.groupBy({ by: ["studentId"], where: { sessionId: id }, _sum: { minutes: true } }),
    prisma.submissionAttempt.groupBy({ by: ["studentId"], where: { experimentId: s.experimentId, createdAt: { gte: s.startedAt ?? new Date(0) } }, _count: true }),
  ]);
  const att = new Map(attendance.map((a) => [a.studentId, a.status]));
  const sub = new Map(subs.map((x) => [x.studentId, x]));
  const draft = new Map<string, Date>();
  for (const d of drafts) if (!draft.has(d.studentId) || draft.get(d.studentId)! < d.updatedAt) draft.set(d.studentId, d.updatedAt);
  const ext = new Map(extensions.map((e) => [e.studentId, e._sum.minutes ?? 0]));
  const runs = new Map(attempts.map((a) => [a.studentId, a._count]));
  return {
    session: { id: s.id, status: s.status, sequence: s.sequence, startedAt: s.startedAt, endsAt: s.endsAt, durationMin: s.durationMin, allowLate: s.allowLate, experiment: s.experiment, subject: s.offering.subject.name, batch: s.offering.batch.name },
    serverNow: new Date().toISOString(),
    students: enrolled.map(({ student }) => {
      const x = sub.get(student.id);
      return {
        id: student.id, name: student.name, enrollmentNo: student.enrollmentNo, attendance: att.get(student.id) ?? null,
        lastSaved: draft.get(student.id) ?? null, runs: runs.get(student.id) ?? 0, extensionMinutes: (ext.get(student.id) ?? 0) + student.extraTimeMinutes,
        submission: x ? { id: x.id, submittedAt: x.submittedAt, status: x.status, isLate: x.isLate, verdict: x.evaluation?.verdict, tests: x.evaluation ? `${x.evaluation.testsPassed}/${x.evaluation.testsTotal}` : null, marks: x.evaluation?.totalMarks } : null,
      };
    }),
  };
}
