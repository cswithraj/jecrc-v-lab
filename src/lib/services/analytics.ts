import { prisma } from "@/lib/db";
import { round2 } from "@/lib/utils";

/** Aggregates for a set of classes (offerings). All numbers are computed from stored records. */
export async function offeringAnalytics(offeringIds: string[]) {
  if (!offeringIds.length) return { perExperiment: [], perOffering: [], failedTests: [], pendingReview: 0 };
  const sessions = await prisma.practicalSession.findMany({
    where: { offeringId: { in: offeringIds } },
    select: { id: true, offeringId: true, sequence: true, status: true, experiment: { select: { id: true, title: true, number: true } }, offering: { select: { subject: { select: { shortName: true } }, batch: { select: { code: true } }, _count: { select: { enrollments: true } } } } },
  });
  const evals = await prisma.submission.findMany({ where: { sessionId: { in: sessions.map((s) => s.id) } }, select: { sessionId: true, status: true, evaluation: { select: { totalMarks: true, maxMarks: true, verdict: true, manualMarks: true } } } });
  const bySession = new Map<string, typeof evals>();
  for (const e of evals) bySession.set(e.sessionId!, [...(bySession.get(e.sessionId!) ?? []), e]);

  const perExperiment = sessions.filter((s) => s.status !== "SCHEDULED").map((s) => {
    const xs = bySession.get(s.id) ?? [];
    const scored = xs.filter((x) => x.evaluation);
    const avg = scored.length ? scored.reduce((a, x) => a + (x.evaluation!.totalMarks / x.evaluation!.maxMarks) * 100, 0) / scored.length : 0;
    const accepted = scored.filter((x) => x.evaluation!.verdict === "ACCEPTED").length;
    return {
      sessionId: s.id, label: `${s.offering.subject.shortName} #${s.sequence}`, title: s.experiment.title,
      avg: round2(avg), submissions: xs.length, enrolled: s.offering._count.enrollments,
      submissionRate: s.offering._count.enrollments ? round2((xs.length / s.offering._count.enrollments) * 100) : 0,
      acceptedRate: scored.length ? round2((accepted / scored.length) * 100) : 0,
    };
  });
  const perOffering = offeringIds.map((oid) => {
    const ss = sessions.filter((s) => s.offeringId === oid);
    const pe = perExperiment.filter((p) => ss.some((s) => s.id === p.sessionId));
    return { offeringId: oid, held: ss.filter((s) => s.status === "ENDED").length, avg: pe.length ? round2(pe.reduce((a, p) => a + p.avg, 0) / pe.length) : null, submissionRate: pe.length ? round2(pe.reduce((a, p) => a + p.submissionRate, 0) / pe.length) : null };
  });
  // Most frequently failed test cases from graded attempts in these sessions
  const attempts = await prisma.submissionAttempt.findMany({ where: { kind: "SUBMIT", submission: { sessionId: { in: sessions.map((s) => s.id) } } }, select: { details: true, experiment: { select: { title: true } } } });
  const failCount = new Map<string, { title: string; n: number; total: number; hidden: boolean; idx: number }>();
  for (const a of attempts) {
    (a.details as { testId: string; passed: boolean; hidden: boolean }[] | null)?.forEach((t, idx) => {
      const k = t.testId;
      const cur = failCount.get(k) ?? { title: a.experiment.title, n: 0, total: 0, hidden: t.hidden, idx };
      cur.total++; if (!t.passed) cur.n++;
      failCount.set(k, cur);
    });
  }
  const failedTests = [...failCount.values()].filter((f) => f.n > 0).sort((a, b) => b.n / b.total - a.n / a.total).slice(0, 8).map((f) => ({ ...f, rate: round2((f.n / f.total) * 100) }));
  const pendingReview = evals.filter((e) => e.evaluation && e.evaluation.manualMarks == null).length;
  return { perExperiment, perOffering, failedTests, pendingReview };
}
