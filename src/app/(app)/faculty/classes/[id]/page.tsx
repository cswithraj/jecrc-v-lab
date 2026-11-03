import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageOffering } from "@/lib/rbac";
import { previewResults } from "@/lib/services/results";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, PageHeader, Table, THead, TBody, TR, TH, TD, Badge, LinkButton, Progress, StatCard } from "@/components/ui";
import { VivaEditor } from "@/components/classes/viva-form";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Class" };

const STATUS: Record<string, "success" | "warning" | "secondary" | "default"> = { ENDED: "secondary", LIVE: "success", SCHEDULED: "default", CANCELLED: "warning" };

export default async function ClassDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["FACULTY", "HOD", "SUPER_ADMIN"]);
  const { id } = await params;
  if (!(await canManageOffering(user, id))) notFound();
  const o = await prisma.subjectOffering.findUnique({
    where: { id },
    include: {
      subject: { select: { name: true, code: true, slug: true, credits: true } }, batch: { select: { name: true } }, academicSession: { select: { name: true } },
      sessions: { orderBy: { sequence: "asc" }, include: { experiment: { select: { title: true, difficulty: true } }, _count: { select: { submissions: true, attendance: { where: { status: { in: ["PRESENT", "LATE"] } } } } } } },
      enrollments: { where: { status: "ACTIVE" }, select: { studentId: true, vivaMarks: true, student: { select: { name: true, enrollmentNo: true } } }, orderBy: { student: { name: "asc" } } },
    },
  });
  if (!o) notFound();
  const p = await previewResults(id);
  const byStudent = new Map(p.rows.map((r) => [r.studentId, r]));
  const roster = [...o.enrollments].sort((a, b) => (a.student.enrollmentNo ?? "").localeCompare(b.student.enrollmentNo ?? ""));
  const atRisk = p.rows.filter((r) => r.attendancePercent < p.policy.minAttendancePercent).length;
  const avg = p.rows.length ? Math.round((p.rows.reduce((a, r) => a + r.experimentAvg, 0) / p.rows.length) * 10) / 10 : 0;

  return (
    <>
      <PageHeader eyebrow={<Link href="/faculty/classes" className="hover:underline">My classes</Link>} title={`${o.subject.name}`}
        description={`${o.batch.name} · ${o.academicSession.name} · ${o.subject.credits} credit(s) · ${p.required} practicals required`}
        actions={<><LinkButton href={`/practicals?offering=${o.id}`} variant="outline">Schedule practical</LinkButton><LinkButton href={`/results?offering=${o.id}`}>Results</LinkButton></>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students" value={roster.length} />
        <StatCard label="Practicals held" value={`${p.sessionsHeld} / ${p.required}`} />
        <StatCard label="Class average" value={`${avg}%`} hint="Over required practicals; missing counts as 0" />
        <StatCard label="Below attendance minimum" value={atRisk} hint={`Under ${p.policy.minAttendancePercent}%`} />
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Students</CardTitle><CardDescription>Progress so far. Average uses all evaluated practicals, including unreleased marks.</CardDescription></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><tr><TH>Enrollment no.</TH><TH>Student</TH><TH>Practicals</TH><TH className="text-right">Avg %</TH><TH className="text-right">Attendance</TH><TH className="text-right">Viva</TH></tr></THead>
            <TBody>{roster.map((e) => { const r = byStudent.get(e.studentId); return (
              <TR key={e.studentId}>
                <TD className="text-sm tabular-nums">{e.student.enrollmentNo}</TD>
                <TD className="font-medium">{e.student.name}</TD>
                <TD><div className="flex min-w-36 items-center gap-2"><Progress value={((r?.experimentsDone ?? 0) / Math.max(1, p.required)) * 100} className="flex-1" /><span className="text-xs tabular-nums">{r?.experimentsDone ?? 0}/{p.required}</span></div></TD>
                <TD className="text-right tabular-nums">{r?.experimentAvg ?? 0}</TD>
                <TD className="text-right tabular-nums">{r && r.attendancePercent < p.policy.minAttendancePercent ? <Badge variant="destructive">{r.attendancePercent}%</Badge> : `${r?.attendancePercent ?? 100}%`}</TD>
                <TD className="text-right tabular-nums">{e.vivaMarks ?? "—"}</TD>
              </TR>); })}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Practical sessions</CardTitle><CardDescription>{o.sessions.length} scheduled in total.</CardDescription></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><tr><TH>#</TH><TH>Experiment</TH><TH>Scheduled</TH><TH>Status</TH><TH className="text-right">Present</TH><TH className="text-right">Submissions</TH><TH /></tr></THead>
            <TBody>{o.sessions.map((s) => (
              <TR key={s.id}>
                <TD className="tabular-nums">{s.sequence}</TD>
                <TD>{s.experiment.title}</TD>
                <TD className="text-sm">{fmtDateTime(s.scheduledStart)}</TD>
                <TD><Badge variant={STATUS[s.status] ?? "secondary"}>{s.status.toLowerCase()}</Badge></TD>
                <TD className="text-right tabular-nums">{s._count.attendance}</TD>
                <TD className="text-right tabular-nums">{s._count.submissions}</TD>
                <TD className="text-right"><Link className="text-sm font-medium text-primary hover:underline" href={`/practicals/${s.id}`}>Open</Link></TD>
              </TR>))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>End-of-lab viva</CardTitle><CardDescription>Marks out of 100. They count for {p.policy.weights.viva}% of the final result.</CardDescription></CardHeader>
        <CardContent><VivaEditor offeringId={o.id} locked={o.resultsFinalized} rows={roster.map((e) => ({ studentId: e.studentId, name: e.student.name, enrollmentNo: e.student.enrollmentNo, viva: e.vivaMarks }))} /></CardContent>
      </Card>
    </>
  );
}
