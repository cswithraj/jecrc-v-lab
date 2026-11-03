import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { managedOfferings } from "@/lib/services/offerings";
import { Card, PageHeader, Select, Button, Table, THead, TBody, TR, TH, TD, VerdictBadge, Badge, EmptyState } from "@/components/ui";
import { Pagination } from "@/components/common/pagination";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Review submissions" };
const PAGE = 25;

export default async function ReviewList({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(["FACULTY", "HOD", "SUPER_ADMIN"]);
  const sp = await searchParams;
  const offerings = await managedOfferings(user);
  const ids = sp.offering ? offerings.filter((o) => o.id === sp.offering).map((o) => o.id) : offerings.map((o) => o.id);
  const page = Math.max(1, Number(sp.page || 1));
  const where: Prisma.SubmissionWhereInput = { session: { offeringId: { in: ids } } };
  if ((sp.status ?? "pending") === "pending") where.evaluation = { manualMarks: null };
  if (sp.status === "finalized") where.status = "FINALIZED";
  const [total, rows] = await Promise.all([
    prisma.submission.count({ where }),
    prisma.submission.findMany({ where, orderBy: { submittedAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { student: { select: { name: true, enrollmentNo: true } }, experiment: { select: { title: true } }, session: { select: { sequence: true, offering: { select: { subject: { select: { shortName: true } }, batch: { select: { code: true } } } } } }, evaluation: { select: { verdict: true, testsPassed: true, testsTotal: true, totalMarks: true, maxMarks: true, manualMarks: true } } } }),
  ]);
  return (
    <>
      <PageHeader eyebrow="Teaching" title="Review submissions" description="Automatic marks cover test cases, compilation and on-time submission. Logic, code quality and efficiency need your judgement." />
      <form className="mb-4 flex flex-wrap gap-2">
        <Select name="offering" defaultValue={sp.offering ?? ""} className="w-64" aria-label="Class"><option value="">All my classes</option>{offerings.map((o) => <option key={o.id} value={o.id}>{o.subject.shortName} · {o.batch.code}</option>)}</Select>
        <Select name="status" defaultValue={sp.status ?? "pending"} className="w-52" aria-label="Status"><option value="pending">Awaiting faculty marks</option><option value="all">All submissions</option><option value="finalized">Finalized</option></Select>
        <Button type="submit" variant="secondary">Apply</Button>
      </form>
      <Card>
        {rows.length === 0 ? <div className="p-6"><EmptyState title="Nothing to review" description="All submissions in this view have faculty marks." /></div> : (
          <Table>
            <THead><tr><TH>Student</TH><TH>Practical</TH><TH>Submitted</TH><TH>Auto result</TH><TH className="text-right">Marks</TH><TH /></tr></THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD><p className="font-medium">{r.student.name}</p><p className="text-xs text-muted-foreground">{r.student.enrollmentNo}</p></TD>
                  <TD><p>{r.session?.offering.subject.shortName} #{r.session?.sequence} · {r.experiment.title}</p><p className="text-xs text-muted-foreground">{r.session?.offering.batch.code}</p></TD>
                  <TD className="text-sm">{fmtDateTime(r.submittedAt)} {r.isLate && <Badge variant="warning">late</Badge>}</TD>
                  <TD>{r.evaluation && <span className="flex items-center gap-2"><VerdictBadge v={r.evaluation.verdict} /><span className="text-xs">{r.evaluation.testsPassed}/{r.evaluation.testsTotal}</span></span>}</TD>
                  <TD className="text-right tabular-nums">{r.evaluation ? `${r.evaluation.totalMarks}/${r.evaluation.maxMarks}` : "—"} {r.status === "FINALIZED" && <Badge variant="success">final</Badge>}</TD>
                  <TD className="text-right"><Link href={`/faculty/review/${r.id}`} className="text-sm font-medium text-primary hover:underline">{r.evaluation?.manualMarks == null ? "Evaluate" : "Open"}</Link></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      <Pagination page={page} pageSize={PAGE} total={total} params={sp} />
    </>
  );
}
