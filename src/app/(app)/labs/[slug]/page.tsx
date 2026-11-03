import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma, Difficulty, Language, PublishStatus } from "@prisma/client";
import { CheckCircle2, Circle, FolderKanban, Settings2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isStaff, canManageSubject } from "@/lib/rbac";
import { studentOfferingProgress } from "@/lib/services/progress";
import { Card, PageHeader, Badge, Input, Select, Button, Table, THead, TBody, TR, TH, TD, DifficultyBadge, Progress, LinkButton, EmptyState } from "@/components/ui";
import { Pagination } from "@/components/common/pagination";
import { SubjectIcon } from "@/components/labs/subject-icon";
import { LANGUAGE_META } from "@/lib/languages";

const PAGE_SIZE = 20;

export default async function SubjectPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const { slug } = await params;
  const sp = await searchParams;
  const subject = await prisma.subject.findUnique({ where: { slug }, include: { topics: { orderBy: { name: "asc" } }, projects: { where: { isActive: true }, select: { id: true, title: true, isGroup: true } }, faculty: { include: { user: { select: { name: true } } } } } });
  if (!subject) notFound();
  const staff = isStaff(user);
  const manage = staff && (await canManageSubject(user, subject.id));
  const page = Math.max(1, Number(sp.page || 1));

  // Student completion status = submitted in any practical session, or an ACCEPTED practice submission
  let doneIds = new Set<string>();
  let progress = null;
  if (user.role === "STUDENT") {
    const subs = await prisma.submission.findMany({ where: { studentId: user.id, experiment: { subjectId: subject.id }, OR: [{ sessionId: { not: null } }, { evaluation: { verdict: "ACCEPTED" } }] }, select: { experimentId: true } });
    doneIds = new Set(subs.map((s) => s.experimentId));
    progress = (await studentOfferingProgress(user.id)).find((o) => o.subject.id === subject.id) ?? null;
  }

  const where: Prisma.ExperimentWhereInput = { subjectId: subject.id };
  if (!staff) where.status = "PUBLISHED";
  else if (sp.status) where.status = sp.status as PublishStatus;
  if (sp.q) {
    const n = Number(sp.q);
    where.OR = [{ title: { contains: sp.q, mode: "insensitive" } }, { code: { contains: sp.q, mode: "insensitive" } }, ...(Number.isInteger(n) ? [{ number: n }] : [])];
  }
  if (sp.difficulty) where.difficulty = sp.difficulty as Difficulty;
  if (sp.topic) where.topicId = sp.topic;
  if (sp.language) where.language = sp.language as Language;
  if (sp.outcome) where.OR = [...(where.OR ?? []), { learningOutcome: { contains: sp.outcome, mode: "insensitive" } }, { courseOutcomes: { has: sp.outcome.toUpperCase() } }];
  if (sp.completion === "done") where.id = { in: [...doneIds] };
  if (sp.completion === "pending") where.id = { notIn: [...doneIds] };

  const [total, experiments, counts] = await Promise.all([
    prisma.experiment.count({ where }),
    prisma.experiment.findMany({ where, orderBy: { number: "asc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: { id: true, code: true, number: true, title: true, difficulty: true, language: true, status: true, estimatedMinutes: true, topic: { select: { name: true } }, _count: { select: { testCases: true } } } }),
    prisma.experiment.groupBy({ by: ["difficulty"], where: { subjectId: subject.id, ...(staff ? {} : { status: "PUBLISHED" }) }, _count: true }),
  ]);
  const byDiff = Object.fromEntries(counts.map((c) => [c.difficulty, c._count]));

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/labs" className="hover:underline">All laboratories</Link>}
        title={subject.name}
        description={subject.description}
        actions={manage ? <LinkButton href={`/faculty/subjects/${subject.id}`} variant="outline"><Settings2 className="h-4 w-4" /> Manage lab</LinkButton> : undefined}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-white" style={{ background: subject.color }}><SubjectIcon name={subject.icon} className="h-6 w-6" /></span>
            <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <div><dt className="text-muted-foreground">Credits</dt><dd className="font-semibold">{subject.credits}</dd></div>
              <div><dt className="text-muted-foreground">Required practicals</dt><dd className="font-semibold">{progress?.required ?? subject.requiredExperiments}</dd></div>
              <div><dt className="text-muted-foreground">Weekly hours</dt><dd className="font-semibold">{subject.hoursPerWeek} h ({subject.hoursPerWeek / 2}×{subject.sessionMinutes / 60} h)</dd></div>
              <div><dt className="text-muted-foreground">Difficulty mix</dt><dd className="font-semibold">{byDiff.EASY ?? 0} / {byDiff.MEDIUM ?? 0} / {byDiff.HARD ?? 0}</dd></div>
              <div className="col-span-2"><dt className="text-muted-foreground">Languages</dt><dd>{subject.languages.map((l) => LANGUAGE_META[l].label).join(", ")}</dd></div>
              <div className="col-span-2"><dt className="text-muted-foreground">Faculty</dt><dd>{subject.faculty.map((f) => f.user.name).join(", ") || "—"}</dd></div>
            </dl>
          </div>
        </Card>
        <Card className="p-5">
          {progress ? (
            <>
              <p className="text-sm font-semibold">My progress</p>
              <p className="mt-1 text-sm text-muted-foreground">Completed {progress.completed} / {progress.required} · Pending {progress.pending}</p>
              <Progress value={progress.progress} className="mt-3" label="Lab progress" />
              <p className="mt-2 text-2xl font-semibold tabular-nums">{progress.progress}%</p>
              <p className="mt-1 text-xs text-muted-foreground">Attendance {progress.attendance ?? "—"}{progress.attendance != null && "%"} · {progress.scheduled} practicals scheduled</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">Final project</p>
              {subject.projects.map((p) => <p key={p.id} className="mt-2 flex items-center gap-2 text-sm"><FolderKanban className="h-4 w-4 text-primary" /> {p.title} <Badge variant="secondary">{p.isGroup ? "Group" : "Individual"}</Badge></p>)}
            </>
          )}
        </Card>
      </div>

      <form className="mt-6 grid gap-2 sm:grid-cols-3 lg:grid-cols-7" aria-label="Filter experiments">
        <Input name="q" defaultValue={sp.q} placeholder="Title, code or number" className="lg:col-span-2" aria-label="Search" />
        <Select name="difficulty" defaultValue={sp.difficulty ?? ""} aria-label="Difficulty"><option value="">All difficulties</option><option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option></Select>
        <Select name="topic" defaultValue={sp.topic ?? ""} aria-label="Topic"><option value="">All topics</option>{subject.topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        <Select name="language" defaultValue={sp.language ?? ""} aria-label="Language"><option value="">All languages</option>{subject.languages.map((l) => <option key={l} value={l}>{LANGUAGE_META[l].label}</option>)}</Select>
        {staff ? (
          <Select name="status" defaultValue={sp.status ?? ""} aria-label="Status"><option value="">Any status</option><option value="PUBLISHED">Published</option><option value="DRAFT">Draft</option><option value="ARCHIVED">Archived</option></Select>
        ) : (
          <Select name="completion" defaultValue={sp.completion ?? ""} aria-label="Completion"><option value="">Any completion</option><option value="done">Completed</option><option value="pending">Not completed</option></Select>
        )}
        <div className="flex gap-2"><Input name="outcome" defaultValue={sp.outcome} placeholder="Outcome / CO" aria-label="Learning outcome" /><Button type="submit" variant="secondary">Filter</Button></div>
      </form>

      <Card className="mt-4">
        {experiments.length === 0 ? <div className="p-6"><EmptyState title="No experiments match these filters" /></div> : (
          <Table>
            <THead><tr><TH className="w-12">#</TH><TH>Experiment</TH><TH>Topic</TH><TH>Difficulty</TH><TH>Language</TH><TH className="text-right">{staff ? "Status" : "Done"}</TH></tr></THead>
            <TBody>
              {experiments.map((e) => (
                <TR key={e.id}>
                  <TD className="tabular-nums text-muted-foreground">{e.number}</TD>
                  <TD><Link href={`/experiments/${e.id}`} className="font-medium hover:text-primary hover:underline">{e.title}</Link><p className="text-xs text-muted-foreground">{e.code} · {e.estimatedMinutes} min · {e._count.testCases} tests</p></TD>
                  <TD className="text-muted-foreground">{e.topic?.name ?? "—"}</TD>
                  <TD><DifficultyBadge d={e.difficulty} /></TD>
                  <TD className="text-muted-foreground">{LANGUAGE_META[e.language].label.split(" (")[0]}</TD>
                  <TD className="text-right">{staff ? <Badge variant={e.status === "PUBLISHED" ? "success" : e.status === "DRAFT" ? "warning" : "secondary"}>{e.status.toLowerCase()}</Badge> : doneIds.has(e.id) ? <CheckCircle2 className="ml-auto h-4 w-4 text-success" aria-label="Completed" /> : <Circle className="ml-auto h-4 w-4 text-muted-foreground" aria-label="Not completed" />}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} params={sp} />
    </>
  );
}
