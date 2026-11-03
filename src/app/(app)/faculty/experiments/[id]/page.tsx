import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageSubject, visibleSubjectIds } from "@/lib/rbac";
import { DEFAULT_RUBRIC, type RubricKey } from "@/lib/evaluation";
import { LANGUAGE_META } from "@/lib/languages";
import { PageHeader, Card, CardHeader, CardTitle, CardContent, LinkButton } from "@/components/ui";
import { ExperimentEditor, type EditorValue } from "@/components/experiments/experiment-editor";
import { ActionButton } from "@/components/common/action-button";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Edit experiment" };

type Theory = { introduction?: string; definition?: string; concepts?: string[]; terminology?: [string, string][]; working?: string; applications?: string[]; examples?: string };

export default async function EditExperiment({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ subject?: string }> }) {
  const user = await requireUser(["FACULTY", "HOD", "SUPER_ADMIN"]);
  const { id } = await params;
  const sp = await searchParams;
  const ids = await visibleSubjectIds(user);
  const subjects = await prisma.subject.findMany({ where: ids === "ALL" ? {} : { id: { in: ids } }, orderBy: { name: "asc" }, select: { id: true, name: true, defaultLanguage: true, defaultEnvironment: true } });

  if (id === "new") {
    const s = subjects.find((x) => x.id === sp.subject) ?? subjects[0];
    if (!s) notFound();
    const next = ((await prisma.experiment.aggregate({ where: { subjectId: s.id }, _max: { number: true } }))._max.number ?? 0) + 1;
    const initial: EditorValue = {
      subjectId: s.id, number: next, title: "", difficulty: "EASY", estimatedMinutes: 120, topic: "", language: s.defaultLanguage, environment: s.defaultEnvironment,
      objectives: "", courseOutcomes: "", learningOutcome: "", introduction: "", definition: "", concepts: "", terminology: "", working: "", applications: "", examples: "",
      problemStatement: "", algorithm: "", pseudocode: "", flowchart: "", starterCode: LANGUAGE_META[s.defaultLanguage]?.template ?? "", referenceCode: "", codeExplanation: "",
      sampleInput: "", sampleOutput: "", conclusion: "", showSolution: false, rubric: { ...DEFAULT_RUBRIC }, maxMarks: 100, timeLimitMs: 2000, memoryLimitKb: 131072,
      testCases: [], vivaQuestions: [],
    };
    return (
      <>
        <PageHeader eyebrow={<Link href={`/faculty/question-bank?subject=${s.id}`} className="hover:underline">Question bank</Link>} title="New experiment" description="New experiments are saved as drafts. Publish from the question bank when ready." />
        <ExperimentEditor id={null} initial={initial} subjects={subjects} />
      </>
    );
  }

  const e = await prisma.experiment.findUnique({ where: { id }, include: { subject: { select: { name: true, slug: true } }, topic: true, testCases: { orderBy: { order: "asc" } }, vivaQs: { orderBy: { order: "asc" } }, versions: { orderBy: { version: "desc" }, take: 20, select: { version: true, createdAt: true, editedById: true } } } });
  if (!e || !(await canManageSubject(user, e.subjectId))) notFound();
  const editors = await prisma.user.findMany({ where: { id: { in: e.versions.map((x) => x.editedById).filter(Boolean) as string[] } }, select: { id: true, name: true } });
  const t = (e.theory ?? {}) as Theory;
  const initial: EditorValue = {
    subjectId: e.subjectId, number: e.number, title: e.title, difficulty: e.difficulty, estimatedMinutes: e.estimatedMinutes, topic: e.topic?.name ?? "", language: e.language, environment: e.environment,
    objectives: e.objectives.join("\n"), courseOutcomes: e.courseOutcomes.join(", "), learningOutcome: e.learningOutcome ?? "",
    introduction: t.introduction ?? "", definition: t.definition ?? "", concepts: (t.concepts ?? []).join("\n"), terminology: (t.terminology ?? []).map(([a, b]) => `${a}: ${b}`).join("\n"), working: t.working ?? "", applications: (t.applications ?? []).join("\n"), examples: t.examples ?? "",
    problemStatement: e.problemStatement, algorithm: e.algorithm.join("\n"), pseudocode: e.pseudocode ?? "", flowchart: e.flowchart ?? "", starterCode: e.starterCode ?? "", referenceCode: e.referenceCode ?? "", codeExplanation: e.codeExplanation ?? "",
    sampleInput: e.sampleInput ?? "", sampleOutput: e.sampleOutput ?? "", conclusion: e.conclusion ?? "", showSolution: e.showSolution,
    rubric: { ...DEFAULT_RUBRIC, ...(e.rubric as Record<RubricKey, number>) }, maxMarks: e.maxMarks, timeLimitMs: e.timeLimitMs, memoryLimitKb: e.memoryLimitKb,
    testCases: e.testCases.map((x) => ({ input: x.input, expected: x.expected, isHidden: x.isHidden, weight: x.weight, compareMode: x.compareMode as EditorValue["testCases"][number]["compareMode"] })),
    vivaQuestions: e.vivaQs.map((q) => ({ question: q.question, answer: q.answer ?? "" })),
  };
  return (
    <>
      <PageHeader eyebrow={<Link href={`/faculty/question-bank?subject=${e.subjectId}`} className="hover:underline">Question bank · {e.subject.name}</Link>} title={`#${e.number} ${e.title}`}
        description={`${e.code} · version ${e.version} · last updated ${fmtDateTime(e.updatedAt)}`}
        actions={<>
          <LinkButton href={`/experiments/${e.id}`} variant="outline">View as student</LinkButton>
          {e.status === "PUBLISHED" ? <ActionButton url={`/api/v1/experiments/${e.id}/unpublish`} variant="outline" confirm="Move back to draft? Students will no longer see it.">Unpublish</ActionButton>
            : <ActionButton url={`/api/v1/experiments/${e.id}/publish`}>Publish</ActionButton>}
        </>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_260px]">
        <ExperimentEditor id={e.id} initial={initial} subjects={subjects} status={e.status} />
        <Card className="h-fit">
          <CardHeader><CardTitle>Version history</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="font-medium">v{e.version}</span> <span className="text-muted-foreground">current</span></p>
            {e.versions.length === 0 ? <p className="text-muted-foreground">No earlier versions.</p> : e.versions.map((x) => (
              <p key={x.version}><span className="font-medium">v{x.version}</span> <span className="text-muted-foreground">· replaced {fmtDateTime(x.createdAt)}{x.editedById ? ` by ${editors.find((u) => u.id === x.editedById)?.name ?? "unknown"}` : ""}</span></p>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
