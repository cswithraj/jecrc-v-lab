import Link from "next/link";
import { CalendarClock, CheckCircle2, Clock, GraduationCap, Percent, FolderKanban } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { studentOfferingProgress } from "@/lib/services/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, PageHeader, Progress, StatCard, Badge, EmptyState, LinkButton, VerdictBadge } from "@/components/ui";
import { SubjectIcon } from "@/components/labs/subject-icon";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Student dashboard" };

export default async function StudentDashboard() {
  const user = await requireUser(["STUDENT"]);
  const [profile, offerings] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, enrollmentNo: true, batch: { select: { name: true, course: { select: { name: true } }, semester: { select: { number: true } } } } } }),
    studentOfferingProgress(user.id),
  ]);
  const totals = offerings.reduce((a, o) => ({ req: a.req + o.required, done: a.done + o.completed, held: a.held + o.held, present: a.present + o.present }), { req: 0, done: 0, held: 0, present: 0 });
  const marks = offerings.map((o) => o.avgMarks).filter((m): m is number => m != null);
  const avg = marks.length ? Math.round((marks.reduce((a, b) => a + b, 0) / marks.length) * 10) / 10 : null;
  const upcoming = offerings.flatMap((o) => o.upcoming.map((s) => ({ ...s, subject: o.subject.name }))).sort((a, b) => +a.scheduledStart - +b.scheduledStart).slice(0, 5);
  const recent = offerings.flatMap((o) => o.recent.map((r) => ({ ...r, subject: o.subject.shortName }))).slice(0, 6);

  return (
    <>
      <PageHeader
        eyebrow="Student dashboard"
        title={`Welcome, ${profile.name.split(" ")[0]}`}
        description={<>{profile.enrollmentNo} · {profile.batch?.course.name} · Semester {profile.batch?.semester?.number ?? "—"} · {profile.batch?.name}</>}
        actions={<LinkButton href="/labs" variant="outline">Browse labs</LinkButton>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Assigned labs" value={offerings.length} hint={`${offerings.reduce((a, o) => a + o.credits, 0)} total credits`} icon={<GraduationCap className="h-4 w-4" />} />
        <StatCard label="Practicals completed" value={`${totals.done} / ${totals.req}`} hint={`${Math.max(0, totals.req - totals.done)} pending`} icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Attendance" value={totals.held ? `${Math.round((totals.present / totals.held) * 1000) / 10}%` : "—"} hint={`${totals.present} of ${totals.held} sessions`} icon={<Percent className="h-4 w-4" />} />
        <StatCard label="Average marks" value={avg == null ? "—" : `${avg}%`} hint="Released marks only" icon={<Clock className="h-4 w-4" />} />
      </div>

      {upcoming.some((u) => u.status === "LIVE") && (
        <Card className="mt-6 border-primary/40 bg-primary/5 p-4">
          {upcoming.filter((u) => u.status === "LIVE").map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge>Live now</Badge>
                <p className="mt-1 font-semibold">{u.subject} · Practical {u.sequence}: {u.experiment.title}</p>
              </div>
              <LinkButton href={`/practicals/${u.id}`}>Join practical</LinkButton>
            </div>
          ))}
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-lg font-semibold">My laboratories</h2>
          {offerings.length === 0 && <EmptyState title="No laboratories assigned yet" description="Your faculty or administrator will enrol you in your lab classes." />}
          {offerings.map((o) => (
            <Card key={o.offeringId} className="p-5">
              <div className="flex flex-wrap items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white" style={{ background: o.subject.color }}><SubjectIcon name={o.subject.icon} className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/labs/${o.subject.slug}`} className="font-semibold hover:underline">{o.subject.name}</Link>
                    <Badge variant="secondary">{o.credits} credit{o.credits > 1 ? "s" : ""}</Badge>
                    {o.team && <Badge variant="outline"><FolderKanban className="h-3 w-3" /> {o.team.status.replace("_", " ").toLowerCase()}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Completed {o.completed} / {o.required} · Pending {o.pending} · Attendance {o.attendance ?? "—"}{o.attendance != null ? "%" : ""} · Avg {o.avgMarks ?? "—"}{o.avgMarks != null ? "%" : ""}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <Progress value={o.progress} label={`${o.subject.name} progress`} />
                    <span className="w-12 text-right text-sm font-medium tabular-nums">{o.progress}%</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" /> Upcoming practicals</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No practicals scheduled.</p>}
              {upcoming.map((u) => (
                <Link key={u.id} href={`/practicals/${u.id}`} className="block rounded-md border p-3 hover:bg-muted/50">
                  <p className="text-sm font-medium">{u.subject} · #{u.sequence}</p>
                  <p className="text-sm text-muted-foreground">{u.experiment.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{u.status === "LIVE" ? "In progress" : fmtDateTime(u.scheduledStart)} · {u.durationMin} min</p>
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Recent marks</CardTitle><CardDescription>Shown after faculty release</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {recent.length === 0 && <p className="text-sm text-muted-foreground">No released marks yet.</p>}
              {recent.map((r) => (
                <div key={r.sessionId} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0"><p className="truncate font-medium">{r.title}</p><p className="text-xs text-muted-foreground">{r.subject} · #{r.seq} · <VerdictBadge v={r.verdict} /></p></div>
                  <span className="shrink-0 font-semibold tabular-nums">{r.marks}/{r.max}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
