import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { managedOfferings } from "@/lib/services/offerings";
import { offeringAnalytics } from "@/lib/services/analytics";
import { previewResults } from "@/lib/services/results";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, Select, Button, StatCard, Table, THead, TBody, TR, TH, TD, EmptyState, Badge } from "@/components/ui";
import { BarChartCard } from "@/components/charts/bar";

export const metadata = { title: "Reports & analytics" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(["FACULTY", "HOD", "SUPER_ADMIN"]);
  const sp = await searchParams;
  const offerings = await managedOfferings(user);
  if (!offerings.length) return (<><PageHeader eyebrow="Teaching" title="Reports & analytics" /><EmptyState title="No classes" description="Reports appear once you have classes." /></>);
  const o = offerings.find((x) => x.id === sp.offering) ?? offerings[0];
  const [a, p, verdicts] = await Promise.all([
    offeringAnalytics([o.id]),
    previewResults(o.id),
    prisma.evaluationResult.groupBy({ by: ["verdict"], where: { submission: { session: { offeringId: o.id } } }, _count: true }),
  ]);
  const bands = p.policy.bands.slice().sort((x, y) => y.min - x.min);
  const gradeDist = bands.map((b) => ({ label: b.grade, value: p.rows.filter((r) => r.grade === b.grade).length, hint: `students with grade ${b.grade}` }));
  const attBuckets = [[90, 101, "90–100%"], [75, 90, "75–89%"], [50, 75, "50–74%"], [0, 50, "under 50%"]] as const;
  const attDist = attBuckets.map(([lo, hi, label]) => ({ label, value: p.rows.filter((r) => r.attendancePercent >= lo && r.attendancePercent < hi).length, hint: "students" }));
  const atRisk = p.rows.filter((r) => r.attendancePercent < p.policy.minAttendancePercent || r.experimentAvg < p.policy.passPercent).sort((x, y) => x.weightedScore - y.weightedScore);
  const totalVerdicts = verdicts.reduce((s, v) => s + v._count, 0);
  const avg = p.rows.length ? Math.round((p.rows.reduce((s, r) => s + r.experimentAvg, 0) / p.rows.length) * 10) / 10 : 0;
  const subRate = a.perExperiment.length ? Math.round(a.perExperiment.reduce((s, x) => s + x.submissionRate, 0) / a.perExperiment.length) : 0;

  return (
    <>
      <PageHeader eyebrow="Teaching" title="Reports & analytics" description="Computed live from submissions, evaluations and attendance. Draft figures: they change as marks are entered." />
      <form className="mb-6 flex flex-wrap gap-2">
        <Select name="offering" defaultValue={o.id} className="w-72" aria-label="Class">{offerings.map((x) => <option key={x.id} value={x.id}>{x.subject.name} · {x.batch.code}</option>)}</Select>
        <Button type="submit" variant="secondary">Show</Button>
      </form>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Practicals held" value={`${p.sessionsHeld} / ${p.required}`} />
        <StatCard label="Class average" value={`${avg}%`} hint="Over required practicals, missing = 0" />
        <StatCard label="Average submission rate" value={`${subRate}%`} hint="Across held practicals" />
        <StatCard label="Students at risk" value={atRisk.length} hint={`Attendance under ${p.policy.minAttendancePercent}% or average under ${p.policy.passPercent}%`} />
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Average marks by practical</CardTitle><CardDescription>Percent of maximum, submitted work only</CardDescription></CardHeader><CardContent><BarChartCard label="Average marks" unit="%" max={100} data={a.perExperiment.map((x) => ({ label: x.label.split(" ").pop() ?? x.label, value: x.avg, hint: x.title }))} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Submission rate by practical</CardTitle><CardDescription>Share of enrolled students who submitted</CardDescription></CardHeader><CardContent><BarChartCard label="Submission rate" unit="%" max={100} data={a.perExperiment.map((x) => ({ label: x.label.split(" ").pop() ?? x.label, value: x.submissionRate, hint: x.title }))} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Projected grade distribution</CardTitle><CardDescription>If results were computed now ({p.policy.name})</CardDescription></CardHeader><CardContent><BarChartCard label="Students" data={gradeDist} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Attendance distribution</CardTitle><CardDescription>Over {p.sessionsHeld} practical(s) held</CardDescription></CardHeader><CardContent><BarChartCard label="Students" data={attDist} /></CardContent></Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader><CardTitle>Students at risk</CardTitle><CardDescription>Lowest projected score first</CardDescription></CardHeader>
          <CardContent className="p-0">
            {atRisk.length === 0 ? <div className="p-6"><EmptyState title="No students at risk" /></div> : (
              <Table>
                <THead><tr><TH>Student</TH><TH className="text-right">Practicals</TH><TH className="text-right">Avg %</TH><TH className="text-right">Attendance</TH><TH className="text-right">Projected</TH></tr></THead>
                <TBody>{atRisk.map((r) => (
                  <TR key={r.studentId}>
                    <TD><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.enrollmentNo}</p></TD>
                    <TD className="text-right tabular-nums">{r.experimentsDone}/{r.experimentsRequired}</TD>
                    <TD className="text-right tabular-nums">{r.experimentAvg < p.policy.passPercent ? <Badge variant="destructive">{r.experimentAvg}</Badge> : r.experimentAvg}</TD>
                    <TD className="text-right tabular-nums">{r.attendancePercent < p.policy.minAttendancePercent ? <Badge variant="destructive">{r.attendancePercent}%</Badge> : `${r.attendancePercent}%`}</TD>
                    <TD className="text-right tabular-nums">{r.weightedScore}</TD>
                  </TR>))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Submission outcomes</CardTitle><CardDescription>{totalVerdicts} evaluated submission(s)</CardDescription></CardHeader>
            <CardContent className="space-y-1.5 text-sm">{verdicts.sort((x, y) => y._count - x._count).map((v) => <p key={v.verdict} className="flex justify-between"><span>{v.verdict.replace(/_/g, " ").toLowerCase()}</span><span className="tabular-nums">{v._count} · {Math.round((v._count / Math.max(1, totalVerdicts)) * 100)}%</span></p>)}{!verdicts.length && <p className="text-muted-foreground">No evaluations yet.</p>}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Frequently failed tests</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">{a.failedTests.map((f, i) => <p key={i} className="flex justify-between gap-3"><span className="truncate">{f.title} · test {f.idx + 1}{f.hidden ? " (hidden)" : ""}</span><span className="shrink-0 tabular-nums">{f.rate}% fail</span></p>)}{!a.failedTests.length && <p className="text-muted-foreground">No failed tests recorded.</p>}</CardContent>
          </Card>
          {a.pendingReview > 0 && <p className="text-sm"><Link className="font-medium text-primary hover:underline" href={`/faculty/review?offering=${o.id}`}>{a.pendingReview} submission(s) waiting for faculty marks</Link></p>}
        </div>
      </div>
    </>
  );
}
