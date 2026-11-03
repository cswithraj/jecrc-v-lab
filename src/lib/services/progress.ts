import { prisma } from "@/lib/db";
import { pct } from "@/lib/utils";

/** Per-class progress for one student. Only released marks are included. */
export async function studentOfferingProgress(studentId: string) {
  const now = new Date();
  const enrollments = await prisma.studentEnrollment.findMany({
    where: { studentId, status: "ACTIVE" },
    include: {
      offering: {
        include: {
          subject: { select: { id: true, name: true, shortName: true, slug: true, credits: true, requiredExperiments: true, icon: true, color: true } },
          batch: { select: { name: true } },
          sessions: { orderBy: { sequence: "asc" }, include: { experiment: { select: { id: true, title: true, number: true } } } },
          teams: { where: { members: { some: { studentId } } }, select: { id: true, status: true, marks: true, name: true, project: { select: { title: true, maxMarks: true } } } },
        },
      },
    },
  });
  const sessionIds = enrollments.flatMap((e) => e.offering.sessions.map((s) => s.id));
  const [subs, att] = await Promise.all([
    prisma.submission.findMany({ where: { studentId, sessionId: { in: sessionIds } }, select: { sessionId: true, status: true, evaluation: { select: { totalMarks: true, maxMarks: true, verdict: true } } } }),
    prisma.attendance.findMany({ where: { studentId, sessionId: { in: sessionIds } }, select: { sessionId: true, status: true } }),
  ]);
  const subBySession = new Map(subs.map((s) => [s.sessionId!, s]));
  const attBySession = new Map(att.map((a) => [a.sessionId, a.status]));

  return enrollments.map(({ offering: o }) => {
    const required = o.requiredExperiments ?? o.subject.requiredExperiments;
    const completed = o.sessions.filter((s) => subBySession.has(s.id) && subBySession.get(s.id)!.status !== "REOPENED").length;
    // A live session counts toward attendance only once the student has joined it.
    const held = o.sessions.filter((s) => s.status === "ENDED" || (s.status === "LIVE" && attBySession.has(s.id)));
    const present = held.filter((s) => ["PRESENT", "LATE"].includes(attBySession.get(s.id) ?? "")).length;
    const released = o.sessions
      .filter((s) => s.marksReleaseAt && s.marksReleaseAt <= now)
      .map((s) => ({ s, sub: subBySession.get(s.id) }))
      .filter((x) => x.sub?.evaluation);
    const avgMarks = released.length ? released.reduce((a, x) => a + (x.sub!.evaluation!.totalMarks / x.sub!.evaluation!.maxMarks) * 100, 0) / released.length : null;
    const upcoming = o.sessions.filter((s) => s.status === "SCHEDULED" || s.status === "LIVE").sort((a, b) => +a.scheduledStart - +b.scheduledStart);
    return {
      offeringId: o.id,
      subject: o.subject,
      batch: o.batch.name,
      credits: o.subject.credits,
      required,
      completed,
      pending: Math.max(0, required - completed),
      progress: pct(completed, required),
      scheduled: o.sessions.length,
      attendance: held.length ? pct(present, held.length) : null,
      held: held.length,
      present,
      avgMarks: avgMarks == null ? null : Math.round(avgMarks * 10) / 10,
      upcoming,
      recent: released.slice(-3).reverse().map((x) => ({ sessionId: x.s.id, title: x.s.experiment.title, seq: x.s.sequence, marks: x.sub!.evaluation!.totalMarks, max: x.sub!.evaluation!.maxMarks, verdict: x.sub!.evaluation!.verdict })),
      team: o.teams[0] ?? null,
    };
  });
}
export type OfferingProgress = Awaited<ReturnType<typeof studentOfferingProgress>>[number];
