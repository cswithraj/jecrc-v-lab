import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { managedOfferings } from "@/lib/services/offerings";
import { Card, CardHeader, CardTitle, CardContent, PageHeader, Badge, Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui";
import { ScheduleForm } from "@/components/practical/schedule-form";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Practical sessions" };
const TONE = { LIVE: "default", SCHEDULED: "secondary", ENDED: "outline", CANCELLED: "destructive" } as const;

export default async function PracticalsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requireUser();
  const { show } = await searchParams;
  const staff = user.role !== "STUDENT";
  const offerings = staff ? await managedOfferings(user) : [];
  const offeringIds = staff ? offerings.map((o) => o.id) : (await prisma.studentEnrollment.findMany({ where: { studentId: user.id }, select: { offeringId: true } })).map((e) => e.offeringId);
  const sessions = await prisma.practicalSession.findMany({
    where: { offeringId: { in: offeringIds }, ...(show === "all" ? {} : { status: { in: ["LIVE", "SCHEDULED"] } }) },
    orderBy: [{ status: "asc" }, { scheduledStart: show === "all" ? "desc" : "asc" }],
    take: 100,
    include: { offering: { include: { subject: { select: { shortName: true } }, batch: { select: { code: true } } } }, experiment: { select: { title: true, number: true } }, _count: { select: { submissions: true } }, ...(staff ? {} : { submissions: { where: { studentId: user.id }, select: { id: true } } }) },
  });
  const pubExps = staff ? await prisma.experiment.findMany({ where: { status: "PUBLISHED", subjectId: { in: offerings.map((o) => o.subject.id) } }, select: { id: true, subjectId: true, number: true, title: true }, orderBy: { number: "asc" } }) : [];

  return (
    <>
      <PageHeader eyebrow="Laboratory" title="Practical sessions" description={staff ? "Schedule, start and monitor timed practicals. Each session runs for 120 minutes by default." : "Your scheduled and live practicals. Join a live practical to start working."} />
      {staff && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Schedule a practical</CardTitle></CardHeader>
          <CardContent><ScheduleForm offerings={offerings.map((o) => ({ id: o.id, label: `${o.subject.shortName} · ${o.batch.code}`, experiments: pubExps.filter((e) => e.subjectId === o.subject.id).map((e) => ({ id: e.id, label: `#${e.number} ${e.title}` })) }))} /></CardContent>
        </Card>
      )}
      <div className="mb-3 flex gap-2 text-sm">
        <Link href="/practicals" className={!show ? "font-semibold text-primary" : "text-muted-foreground hover:underline"}>Upcoming & live</Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/practicals?show=all" className={show === "all" ? "font-semibold text-primary" : "text-muted-foreground hover:underline"}>All sessions</Link>
      </div>
      <Card>
        {sessions.length === 0 ? <div className="p-6"><EmptyState title="No practical sessions" description={staff ? "Schedule a practical above." : "Your faculty have not scheduled any practicals yet."} /></div> : (
          <Table>
            <THead><tr><TH>Practical</TH><TH>Class</TH><TH>Scheduled</TH><TH>Status</TH><TH className="text-right">{staff ? "Submissions" : "Your submission"}</TH></tr></THead>
            <TBody>
              {sessions.map((s) => (
                <TR key={s.id}>
                  <TD><Link href={`/practicals/${s.id}`} className="font-medium hover:text-primary hover:underline">#{s.sequence} · {s.experiment.title}</Link><p className="text-xs text-muted-foreground">Experiment {s.experiment.number} · {s.durationMin} min</p></TD>
                  <TD>{s.offering.subject.shortName} <span className="text-xs text-muted-foreground">{s.offering.batch.code}</span></TD>
                  <TD className="text-sm">{fmtDateTime(s.scheduledStart)}</TD>
                  <TD><Badge variant={TONE[s.status]}>{s.status === "LIVE" ? "Live" : s.status.toLowerCase()}</Badge></TD>
                  <TD className="text-right text-sm">{staff ? s._count.submissions : ("submissions" in s && (s.submissions as unknown[]).length ? "Submitted" : "—")}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
