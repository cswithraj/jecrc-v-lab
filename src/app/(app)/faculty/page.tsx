import Link from "next/link";
import { Users, Timer, ClipboardCheck, BookOpen } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { managedOfferings } from "@/lib/services/offerings";
import { offeringAnalytics } from "@/lib/services/analytics";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, PageHeader, StatCard, Progress, LinkButton, Badge, EmptyState } from "@/components/ui";
import { BarChartCard } from "@/components/charts/bar";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Faculty dashboard" };

export default async function FacultyDashboard() {
  const user = await requireUser(["FACULTY", "HOD", "SUPER_ADMIN"]);
  const offerings = await managedOfferings(user);
  const ids = offerings.map((o) => o.id);
  const [a, students, live, upcoming] = await Promise.all([
    offeringAnalytics(ids),
    prisma.studentEnrollment.findMany({ where: { offeringId: { in: ids } }, distinct: ["studentId"], select: { studentId: true } }),
    prisma.practicalSession.findMany({ where: { offeringId: { in: ids }, status: "LIVE" }, include: { offering: { include: { subject: true, batch: true } }, experiment: { select: { title: true } } } }),
    prisma.practicalSession.findMany({ where: { offeringId: { in: ids }, status: "SCHEDULED" }, orderBy: { scheduledStart: "asc" }, take: 5, include: { offering: { include: { subject: true, batch: true } }, experiment: { select: { title: true } } } }),
  ]);
  const difficult = [...a.perExperiment].filter((p) => p.submissions > 0).sort((x, y) => x.avg - y.avg).slice(0, 5);

  return (
    <>
      <PageHeader eyebrow="Faculty dashboard" title={`Good day, ${user.name.replace(/\s*\(Demo\)/, "")}`} description="Your classes, live practicals and pending evaluations." actions={<><LinkButton href="/practicals" variant="outline">Schedule practical</LinkButton><LinkButton href="/faculty/review">Review submissions</LinkButton></>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="My classes" value={offerings.length} icon={<BookOpen className="h-4 w-4" />} />
        <StatCard label="Students" value={students.length} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Live practicals" value={live.length} icon={<Timer className="h-4 w-4" />} />
        <StatCard label="Awaiting review" value={a.pendingReview} hint="Logic, quality, efficiency not yet marked" icon={<ClipboardCheck className="h-4 w-4" />} />
      </div>
      {live.map((s) => (
        <Card key={s.id} className="mt-4 flex flex-wrap items-center justify-between gap-3 border-primary/40 bg-primary/5 p-4">
          <div><Badge>Live</Badge><p className="mt-1 font-semibold">{s.offering.subject.shortName} · {s.offering.batch.code} · #{s.sequence} {s.experiment.title}</p></div>
          <LinkButton href={`/practicals/${s.id}`}>Monitor</LinkButton>
        </Card>
      ))}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Average marks by practical</CardTitle><CardDescription>Percent of maximum marks, across your classes</CardDescription></CardHeader>
          <CardContent><BarChartCard label="Average marks" unit="%" max={100} data={a.perExperiment.map((p) => ({ label: p.label, value: p.avg, hint: `${p.label} — ${p.title}` }))} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Upcoming practicals</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Nothing scheduled.</p>}
            {upcoming.map((s) => <Link key={s.id} href={`/practicals/${s.id}`} className="block rounded-md border p-3 hover:bg-muted/50"><p className="text-sm font-medium">{s.offering.subject.shortName} · {s.offering.batch.code} · #{s.sequence}</p><p className="text-sm text-muted-foreground">{s.experiment.title}</p><p className="text-xs text-muted-foreground">{fmtDateTime(s.scheduledStart)}</p></Link>)}
          </CardContent>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>My classes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {offerings.length === 0 && <EmptyState title="No classes assigned" description="An administrator assigns classes to faculty." />}
            {offerings.map((o) => {
              const st = a.perOffering.find((p) => p.offeringId === o.id)!;
              const req = o.subject.requiredExperiments;
              return (
                <Link key={o.id} href={`/faculty/classes/${o.id}`} className="block rounded-md border p-3 hover:bg-muted/40">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{o.subject.name} <span className="text-sm text-muted-foreground">· {o.batch.code}</span></p><span className="text-xs text-muted-foreground">{o._count.enrollments} students · avg {st.avg ?? "—"}{st.avg != null && "%"} · submission rate {st.submissionRate ?? "—"}{st.submissionRate != null && "%"}</span></div>
                  <div className="mt-2 flex items-center gap-3"><Progress value={(st.held / req) * 100} label="Practicals held" /><span className="w-20 text-right text-xs tabular-nums">{st.held}/{req} held</span></div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Most difficult practicals</CardTitle><CardDescription>Lowest average marks</CardDescription></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {difficult.map((d) => <div key={d.sessionId} className="flex justify-between gap-2"><span className="truncate">{d.label} · {d.title}</span><span className="shrink-0 tabular-nums">{d.avg}%</span></div>)}
              {!difficult.length && <p className="text-muted-foreground">No data yet.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Frequently failed test cases</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {a.failedTests.map((f, i) => <div key={i} className="flex justify-between gap-2"><span className="truncate">{f.title} · test {f.idx + 1}{f.hidden ? " (hidden)" : ""}</span><span className="shrink-0 tabular-nums">{f.rate}% fail</span></div>)}
              {!a.failedTests.length && <p className="text-muted-foreground">Appears once students submit practicals through the platform.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
