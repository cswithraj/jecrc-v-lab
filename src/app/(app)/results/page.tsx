import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { managedOfferings } from "@/lib/services/offerings";
import { previewResults, storedResults, activePolicy } from "@/lib/services/results";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, PageHeader, Select, Button, Table, THead, TBody, TR, TH, TD, Badge, EmptyState, Alert, StatCard } from "@/components/ui";
import { ActionButton } from "@/components/common/action-button";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Results & ranking" };

const OUTCOME: Record<string, "success" | "destructive" | "warning" | "secondary"> = { PASS: "success", FAIL: "destructive", DETAINED: "destructive", INCOMPLETE: "warning" };
const Outcome = ({ o }: { o: string }) => <Badge variant={OUTCOME[o] ?? "secondary"}>{o.toLowerCase()}</Badge>;
const n = (v: number | null | undefined) => (v == null ? "—" : String(v));

export default async function ResultsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  return user.role === "STUDENT" ? <StudentResults userId={user.id} /> : <StaffResults user={user} sp={await searchParams} />;
}

async function StudentResults({ userId }: { userId: string }) {
  const [results, enrollments] = await Promise.all([
    prisma.finalResult.findMany({ where: { studentId: userId, status: "FINALIZED" }, include: { offering: { include: { subject: { select: { name: true, code: true, credits: true } }, academicSession: { select: { name: true } }, _count: { select: { enrollments: true } } } } } }),
    prisma.studentEnrollment.count({ where: { studentId: userId, status: "ACTIVE" } }),
  ]);
  const credits = results.reduce((a, r) => a + r.offering.subject.credits, 0);
  const sgpa = credits ? Math.round((results.reduce((a, r) => a + r.gradePoints * r.offering.subject.credits, 0) / credits) * 100) / 100 : null;
  return (
    <>
      <PageHeader eyebrow="Laboratory" title="Results & ranking" description="Final laboratory results appear here once your faculty finalizes them. Marks for individual practicals are on your dashboard." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Labs with final result" value={`${results.length} / ${enrollments}`} />
        <StatCard label="Lab credits earned" value={results.filter((r) => r.outcome === "PASS").reduce((a, r) => a + r.offering.subject.credits, 0)} />
        <StatCard label="Lab grade point average" value={sgpa ?? "—"} hint="Credit-weighted, laboratory courses only" />
      </div>
      <Card>
        {results.length === 0 ? <div className="p-6"><EmptyState title="No final results yet" description="Results are published when your faculty finalizes them at the end of the semester." /></div> : (
          <Table>
            <THead><tr><TH>Laboratory</TH><TH className="text-right">Practicals</TH><TH className="text-right">Attendance</TH><TH className="text-right">Project</TH><TH className="text-right">Viva</TH><TH className="text-right">Score</TH><TH>Grade</TH><TH>Rank</TH><TH>Outcome</TH></tr></THead>
            <TBody>{results.map((r) => (
              <TR key={r.id}>
                <TD><p className="font-medium">{r.offering.subject.name}</p><p className="text-xs text-muted-foreground">{r.offering.subject.code} · {r.offering.academicSession.name} · {r.offering.subject.credits} credit(s)</p></TD>
                <TD className="text-right tabular-nums">{r.experimentsDone}/{r.experimentsRequired} · {r.experimentAvg}%</TD>
                <TD className="text-right tabular-nums">{r.attendancePercent}%</TD>
                <TD className="text-right tabular-nums">{n(r.projectMarks)}</TD>
                <TD className="text-right tabular-nums">{n(r.vivaMarks)}</TD>
                <TD className="text-right font-semibold tabular-nums">{r.weightedScore}</TD>
                <TD className="font-semibold">{r.grade}</TD>
                <TD className="tabular-nums">{r.rank ?? "—"} <span className="text-xs text-muted-foreground">of {r.offering._count.enrollments}</span></TD>
                <TD><Outcome o={r.outcome} /></TD>
              </TR>))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}

async function StaffResults({ user, sp }: { user: Awaited<ReturnType<typeof requireUser>>; sp: Record<string, string | undefined> }) {
  const offerings = await managedOfferings(user);
  const o = offerings.find((x) => x.id === sp.offering) ?? offerings[0];
  if (!o) return (<><PageHeader eyebrow="Laboratory" title="Results & ranking" /><EmptyState title="No classes" description="You are not assigned to any class yet." /></>);
  const [preview, stored, policy] = await Promise.all([previewResults(o.id), storedResults(o.id), activePolicy()]);
  const finalized = o.resultsFinalized;
  const api = `/api/v1/offerings/${o.id}/results`;
  const lastComputed = stored.reduce<Date | null>((a, r) => (!a || r.computedAt > a ? r.computedAt : a), null);
  const isAdmin = user.role === "SUPER_ADMIN" || user.role === "HOD";
  const w = policy.weights;
  return (
    <>
      <PageHeader eyebrow="Laboratory" title="Results & ranking"
        description={<>Weights: practicals {w.experiments}%, project {w.project}%, viva {w.viva}%, attendance {w.attendance}% · pass at {policy.passPercent}% · minimum attendance {policy.minAttendancePercent}% ({policy.name}).</>} />
      <form className="mb-4 flex flex-wrap gap-2">
        <Select name="offering" defaultValue={o.id} className="w-72" aria-label="Class">{offerings.map((x) => <option key={x.id} value={x.id}>{x.subject.name} · {x.batch.code}</option>)}</Select>
        <Button type="submit" variant="secondary">Show</Button>
      </form>

      <div className="mb-4 flex flex-wrap items-start gap-2">
        {!finalized && <ActionButton url={`${api}/compute`} variant="outline">{stored.length ? "Recompute draft" : "Compute draft results"}</ActionButton>}
        {!finalized && stored.length > 0 && <ActionButton url={`${api}/finalize`} confirm="Finalize results? Students will see them and they can no longer be recomputed without an administrator unlocking them.">Finalize & publish</ActionButton>}
        {finalized && isAdmin && <ActionButton url={`${api}/unlock`} variant="outline" reasonPrompt="Reason for unlocking finalized results (recorded in the audit log):">Unlock results</ActionButton>}
        {stored.length > 0 && <>
          <a className="inline-flex h-9 items-center rounded-md border bg-card px-4 text-sm font-medium hover:bg-muted" href={`${api}/export?format=pdf`}>Export PDF</a>
          <a className="inline-flex h-9 items-center rounded-md border bg-card px-4 text-sm font-medium hover:bg-muted" href={`${api}/export?format=xlsx`}>Export Excel</a>
          <a className="inline-flex h-9 items-center rounded-md border bg-card px-4 text-sm font-medium hover:bg-muted" href={`${api}/export?format=csv`}>Export CSV</a>
        </>}
      </div>

      {finalized ? <Alert tone="success" className="mb-4">Finalized{stored[0]?.finalizedAt ? ` on ${fmtDateTime(stored[0].finalizedAt)}` : ""}. Students can see these results.</Alert>
        : <Alert tone="warning" className="mb-4">
            {stored.length ? <>Draft computed {fmtDateTime(lastComputed)}. Students cannot see drafts.</> : <>No results computed yet. The preview below shows what computing now would give.</>}
            {preview.pendingManual > 0 && <> {preview.pendingManual} submission(s) still need faculty marks. <Link className="font-medium underline" href={`/faculty/review?offering=${o.id}`}>Review them</Link>.</>}
            {" "}{preview.sessionsHeld} of {preview.required} practicals held so far; missing practicals count as zero.
          </Alert>}

      <Card>
        <CardHeader><CardTitle>{o.subject.name} · {o.batch.name}</CardTitle><CardDescription>{stored.length ? (finalized ? "Final results" : "Stored draft") : "Live preview (not saved)"} · ties share a rank (1, 2, 2, 4) · tie-break order: {policy.tieBreak.join(" → ")}</CardDescription></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><tr><TH>Rank</TH><TH>Student</TH><TH className="text-right">Practicals</TH><TH className="text-right">Avg %</TH><TH className="text-right">Attendance</TH><TH className="text-right">Project</TH><TH className="text-right">Viva</TH><TH className="text-right">Score</TH><TH>Grade</TH><TH>Outcome</TH></tr></THead>
            <TBody>{(stored.length ? stored.map((r) => ({ ...r, name: r.student.name, enrollmentNo: r.student.enrollmentNo })) : preview.rows).map((r) => (
              <TR key={r.studentId}>
                <TD className="font-semibold tabular-nums">{r.rank ?? "—"}</TD>
                <TD><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.enrollmentNo}</p></TD>
                <TD className="text-right tabular-nums">{r.experimentsDone}/{r.experimentsRequired}</TD>
                <TD className="text-right tabular-nums">{r.experimentAvg}</TD>
                <TD className="text-right tabular-nums">{r.attendancePercent}%</TD>
                <TD className="text-right tabular-nums">{n(r.projectMarks)}</TD>
                <TD className="text-right tabular-nums">{n(r.vivaMarks)}</TD>
                <TD className="text-right font-semibold tabular-nums">{r.weightedScore}</TD>
                <TD className="font-semibold">{r.grade}</TD>
                <TD><Outcome o={r.outcome} /></TD>
              </TR>))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
