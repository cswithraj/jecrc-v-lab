import Link from "next/link";
import { notFound } from "next/navigation";
import type { Language } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageOffering } from "@/lib/rbac";
import { getExamRules } from "@/lib/settings";
import { studentSessionStatus, monitor } from "@/lib/services/sessions";
import { Card, PageHeader, Badge } from "@/components/ui";
import { StudentPractical, type PracticalStatus } from "@/components/practical/student-practical";
import { FacultyMonitor } from "@/components/practical/faculty-monitor";
import { LANGUAGE_META } from "@/lib/languages";
import { fmtDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PracticalPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const s = await prisma.practicalSession.findUnique({
    where: { id },
    include: { offering: { include: { subject: true, batch: true } }, experiment: { include: { testCases: { where: { isHidden: false }, orderBy: { order: "asc" } } } } },
  });
  if (!s) notFound();
  const header = (
    <PageHeader
      eyebrow={<Link href="/practicals" className="hover:underline">{s.offering.subject.name} · {s.offering.batch.code}</Link>}
      title={`Practical #${s.sequence}: ${s.experiment.title}`}
      description={<>Scheduled {fmtDateTime(s.scheduledStart)} · {s.durationMin} minutes · Experiment {s.experiment.number} <Badge variant="secondary" className="ml-1">{s.status.toLowerCase()}</Badge></>}
    />
  );

  if (user.role !== "STUDENT") {
    if (!(await canManageOffering(user, s.offeringId))) notFound();
    const m = await monitor(user, id);
    return <>{header}<FacultyMonitor initial={JSON.parse(JSON.stringify(m))} /></>;
  }

  const enrolled = await prisma.studentEnrollment.findUnique({ where: { offeringId_studentId: { offeringId: s.offeringId, studentId: user.id } } });
  if (!enrolled) notFound();
  const [status, drafts, rules] = await Promise.all([
    studentSessionStatus(user, id),
    prisma.codeDraft.findMany({ where: { studentId: user.id, experimentId: s.experimentId } }),
    getExamRules(),
  ]);
  const exp = s.experiment;
  const langs = [...new Set<Language>([exp.language, ...s.offering.subject.languages])].filter((l) => l !== "NONE" || exp.language === "NONE");

  return (
    <>
      {header}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="h-fit p-5 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-auto">
          <h2 className="font-semibold">Problem statement</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-6">{exp.problemStatement}</p>
          {exp.objectives.length > 0 && <><h3 className="mt-4 text-sm font-semibold">Objectives</h3><ul className="mt-1 list-disc pl-5 text-sm">{exp.objectives.map((o) => <li key={o}>{o}</li>)}</ul></>}
          {exp.sampleInput != null && <div className="mt-4 grid gap-2 sm:grid-cols-2"><div><p className="text-xs font-medium text-muted-foreground">Sample input</p><pre className="code-block p-2 text-xs">{exp.sampleInput}</pre></div><div><p className="text-xs font-medium text-muted-foreground">Sample output</p><pre className="code-block p-2 text-xs">{exp.sampleOutput}</pre></div></div>}
          <p className="mt-4 text-xs text-muted-foreground">Languages: {langs.map((l) => LANGUAGE_META[l].label).join(", ")} · Time limit {exp.timeLimitMs / 1000}s per test · {exp.testCases.length} public sample tests, plus hidden tests used for marking.</p>
          <p className="mt-2 text-xs text-muted-foreground"><Link href={`/experiments/${exp.id}#theory`} target="_blank" className="text-primary underline">Open theory and algorithm in a new tab</Link> (the model solution stays hidden during the practical).</p>
        </Card>
        <StudentPractical
          sessionId={id} experimentId={exp.id} languages={langs}
          initial={Object.fromEntries(drafts.map((d) => [d.language, d.code]))}
          starter={{ [exp.language]: exp.starterCode ?? LANGUAGE_META[exp.language].template }}
          hasPublicTests={exp.testCases.length > 0} autosaveSeconds={rules.autosaveSeconds}
          initialStatus={JSON.parse(JSON.stringify(status)) as PracticalStatus} scheduledStart={s.scheduledStart.toISOString()}
        />
      </div>
    </>
  );
}
