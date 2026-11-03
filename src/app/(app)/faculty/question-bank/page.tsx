import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { visibleSubjectIds } from "@/lib/rbac";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, PageHeader, Select, Input, Button, Table, THead, TBody, TR, TH, TD, Badge, DifficultyBadge, EmptyState, LinkButton } from "@/components/ui";
import { Pagination } from "@/components/common/pagination";
import { ActionButton } from "@/components/common/action-button";
import { ImportForm } from "@/components/experiments/import-form";
import { LANGUAGE_META } from "@/lib/languages";

export const metadata = { title: "Question bank" };
const PAGE = 25;
const STATUS = { PUBLISHED: "success", DRAFT: "warning", ARCHIVED: "secondary" } as const;

export default async function QuestionBank({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(["FACULTY", "HOD", "SUPER_ADMIN"]);
  const sp = await searchParams;
  const ids = await visibleSubjectIds(user);
  const subjects = await prisma.subject.findMany({ where: ids === "ALL" ? {} : { id: { in: ids } }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, easyTarget: true, mediumTarget: true, hardTarget: true } });
  const subject = subjects.find((s) => s.id === sp.subject) ?? subjects[0];
  if (!subject) return (<><PageHeader eyebrow="Teaching" title="Question bank" /><EmptyState title="No laboratories assigned" description="Ask an administrator to assign you to a laboratory." /></>);

  const page = Math.max(1, Number(sp.page || 1));
  const where: Prisma.ExperimentWhereInput = { subjectId: subject.id };
  if (sp.status) where.status = sp.status as never;
  if (sp.difficulty) where.difficulty = sp.difficulty as never;
  if (sp.q) where.OR = [{ title: { contains: sp.q, mode: "insensitive" } }, { topic: { name: { contains: sp.q, mode: "insensitive" } } }];
  const [total, rows, counts] = await Promise.all([
    prisma.experiment.count({ where }),
    prisma.experiment.findMany({ where, orderBy: { number: "asc" }, skip: (page - 1) * PAGE, take: PAGE, select: { id: true, number: true, title: true, difficulty: true, language: true, status: true, version: true, updatedAt: true, topic: { select: { name: true } }, _count: { select: { testCases: true, vivaQs: true } } } }),
    prisma.experiment.groupBy({ by: ["status", "difficulty"], where: { subjectId: subject.id }, _count: true }),
  ]);
  const c = (status?: string, d?: string) => counts.filter((x) => (!status || x.status === status) && (!d || x.difficulty === d)).reduce((a, x) => a + x._count, 0);
  const exp = `/api/v1/experiments/export?subjectId=${subject.id}`;

  return (
    <>
      <PageHeader eyebrow="Teaching" title="Question bank"
        description={`${c()} experiments in ${subject.name}: ${c("PUBLISHED")} published, ${c("DRAFT")} draft. Published by level: ${c("PUBLISHED", "EASY")} easy (target ${subject.easyTarget}), ${c("PUBLISHED", "MEDIUM")} medium (target ${subject.mediumTarget}), ${c("PUBLISHED", "HARD")} hard (target ${subject.hardTarget}).`}
        actions={<LinkButton href={`/faculty/experiments/new?subject=${subject.id}`}>New experiment</LinkButton>} />

      <form className="mb-4 flex flex-wrap gap-2">
        <Select name="subject" defaultValue={subject.id} className="w-64" aria-label="Laboratory">{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-36" aria-label="Status"><option value="">Any status</option><option value="PUBLISHED">Published</option><option value="DRAFT">Draft</option><option value="ARCHIVED">Archived</option></Select>
        <Select name="difficulty" defaultValue={sp.difficulty ?? ""} className="w-36" aria-label="Difficulty"><option value="">Any level</option><option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option></Select>
        <Input name="q" defaultValue={sp.q ?? ""} placeholder="Search title or topic" className="w-56" aria-label="Search" />
        <Button type="submit" variant="secondary">Filter</Button>
      </form>

      <Card className="mb-6">
        {rows.length === 0 ? <div className="p-6"><EmptyState title="No experiments match" description="Change the filters or create a new experiment." /></div> : (
          <Table>
            <THead><tr><TH>#</TH><TH>Title</TH><TH>Level</TH><TH>Language</TH><TH className="text-right">Tests</TH><TH className="text-right">Viva</TH><TH>Status</TH><TH className="text-right">Actions</TH></tr></THead>
            <TBody>{rows.map((r) => (
              <TR key={r.id}>
                <TD className="tabular-nums">{r.number}</TD>
                <TD><Link href={`/faculty/experiments/${r.id}`} className="font-medium hover:text-primary hover:underline">{r.title}</Link><p className="text-xs text-muted-foreground">{r.topic?.name ?? "No topic"} · v{r.version}</p></TD>
                <TD><DifficultyBadge d={r.difficulty} /></TD>
                <TD className="text-sm">{LANGUAGE_META[r.language]?.label ?? r.language}</TD>
                <TD className="text-right tabular-nums">{r._count.testCases}</TD>
                <TD className="text-right tabular-nums">{r._count.vivaQs}</TD>
                <TD><Badge variant={STATUS[r.status]}>{r.status.toLowerCase()}</Badge></TD>
                <TD>
                  <div className="flex flex-nowrap justify-end gap-1 whitespace-nowrap">
                    <LinkButton href={`/faculty/experiments/${r.id}`} size="sm" variant="ghost">Edit</LinkButton>
                    {r.status !== "PUBLISHED" ? <ActionButton url={`/api/v1/experiments/${r.id}/publish`} size="sm" variant="outline">Publish</ActionButton>
                      : <ActionButton url={`/api/v1/experiments/${r.id}/unpublish`} size="sm" variant="ghost" confirm="Move back to draft? Students will no longer see it.">Unpublish</ActionButton>}
                    <ActionButton url={`/api/v1/experiments/${r.id}/duplicate`} size="sm" variant="ghost">Duplicate</ActionButton>
                  </div>
                </TD>
              </TR>))}
            </TBody>
          </Table>
        )}
      </Card>
      <Pagination page={page} pageSize={PAGE} total={total} params={sp} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Import from CSV or Excel</CardTitle><CardDescription>Rows are matched on experiment number: existing numbers are updated (previous version kept), new numbers are created as drafts.</CardDescription></CardHeader>
          <CardContent>
            <ImportForm subjectId={subject.id} />
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-medium">File format</summary>
              <div className="mt-2 space-y-1 text-muted-foreground">
                <p>Required columns: <code>number</code>, <code>title</code>, <code>difficulty</code> (EASY, MEDIUM or HARD).</p>
                <p>Optional: topic, language, estimated_minutes, objectives, course_outcomes, problem_statement, introduction, definition, concepts, working, applications, algorithm, pseudocode, sample_input, sample_output, public_tests, hidden_tests, viva.</p>
                <p>Lists use <code>|</code>. Tests are <code>input ==&gt; expected</code>, separated by <code>||</code>. Viva is <code>question ::: answer</code>. Write line breaks as <code>\n</code>.</p>
                <p>The easiest start is to export the current bank and edit it.</p>
              </div>
            </details>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Export</CardTitle><CardDescription>Download this laboratory&apos;s bank in the same format the importer reads.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <a className="inline-flex h-9 items-center rounded-md border bg-card px-4 text-sm font-medium hover:bg-muted" href={`${exp}&format=xlsx`}>Excel (.xlsx)</a>
            <a className="inline-flex h-9 items-center rounded-md border bg-card px-4 text-sm font-medium hover:bg-muted" href={`${exp}&format=csv`}>CSV</a>
            <a className="inline-flex h-9 items-center rounded-md border bg-card px-4 text-sm font-medium hover:bg-muted" href={`${exp}&format=xlsx&hidden=1`}>Excel with hidden tests</a>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
