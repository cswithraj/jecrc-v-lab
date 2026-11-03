"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Play, Square, TimerReset, RefreshCcw } from "lucide-react";
import { Button, Badge, Table, THead, TBody, TR, TH, TD, VerdictBadge, Input, Alert, StatCard } from "@/components/ui";
import { PracticalTimer } from "./timer";

type Monitor = {
  session: { id: string; status: string; sequence: number; startedAt: string | null; endsAt: string | null; durationMin: number; allowLate: boolean };
  serverNow: string;
  students: { id: string; name: string; enrollmentNo: string | null; attendance: string | null; lastSaved: string | null; runs: number; extensionMinutes: number; submission: null | { id: string; submittedAt: string; status: string; isLate: boolean; verdict?: string; tests: string | null; marks?: number } }[];
};

async function post(url: string, body?: object) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? "Request failed");
  return d;
}

export function FacultyMonitor({ initial }: { initial: Monitor }) {
  const router = useRouter();
  const [m, setM] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const id = m.session.id;

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/v1/sessions/${id}/monitor`, { cache: "no-store" });
    if (r.ok) setM(await r.json());
  }, [id]);
  useEffect(() => {
    if (m.session.status !== "LIVE") return;
    const t = setInterval(refresh, 10_000);
    return () => clearInterval(t);
  }, [m.session.status, refresh]);

  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key); setErr(null);
    try { await fn(); await refresh(); router.refresh(); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }
  const extend = (studentId?: string) => {
    const minutes = Number(prompt(studentId ? "Extra minutes for this student:" : "Extend the session for everyone by (minutes):", "10"));
    if (!minutes) return;
    const reason = prompt("Reason (recorded in the audit log):", studentId ? "Authorised extra time" : "Technical issue in lab");
    if (!reason) return;
    act(`ext-${studentId ?? "all"}`, () => post(`/api/v1/sessions/${id}/extend`, { studentId, minutes, reason }));
  };
  const reopen = (studentId: string) => {
    const reason = prompt("Reason for reopening this submission (recorded in the audit log):");
    if (!reason) return;
    act(`re-${studentId}`, () => post(`/api/v1/sessions/${id}/reopen`, { studentId, reason }));
  };

  const s = m.session;
  const present = m.students.filter((x) => x.attendance === "PRESENT" || x.attendance === "LATE").length;
  const submitted = m.students.filter((x) => x.submission && x.submission.status !== "REOPENED").length;
  const accepted = m.students.filter((x) => x.submission?.verdict === "ACCEPTED").length;
  const rows = m.students.filter((x) => !filter || (x.name + (x.enrollmentNo ?? "")).toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-4">
      {err && <Alert tone="error">{err}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        {s.status === "SCHEDULED" && <Button onClick={() => confirm("Start this practical now? The 2-hour timer starts for all students.") && act("start", () => post(`/api/v1/sessions/${id}/start`))} loading={busy === "start"}><Play className="h-4 w-4" /> Start session</Button>}
        {s.status === "LIVE" && <>
          <PracticalTimer deadline={s.endsAt} serverNow={m.serverNow} sync={refresh} />
          <Button variant="outline" onClick={() => extend()} loading={busy === "ext-all"}><TimerReset className="h-4 w-4" /> Extend for all</Button>
          <Button variant="destructive" onClick={() => confirm("End the session now? Students without attendance are marked absent.") && act("end", () => post(`/api/v1/sessions/${id}/end`))} loading={busy === "end"}><Square className="h-4 w-4" /> End session</Button>
        </>}
        {s.status === "ENDED" && <Badge variant="secondary">Ended</Badge>}
        <Button variant="ghost" size="sm" onClick={refresh}><RefreshCcw className="h-4 w-4" /> Refresh</Button>
        <Input className="ml-auto w-60" placeholder="Filter students" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter students" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Enrolled" value={m.students.length} />
        <StatCard label="Present" value={present} />
        <StatCard label="Submitted" value={submitted} />
        <StatCard label="All tests passed" value={accepted} />
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <THead><tr><TH>Student</TH><TH>Attendance</TH><TH>Activity</TH><TH>Submission</TH><TH>Result</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {rows.map((x) => (
              <TR key={x.id}>
                <TD><p className="font-medium">{x.name}</p><p className="text-xs text-muted-foreground">{x.enrollmentNo}{x.extensionMinutes ? ` · +${x.extensionMinutes} min` : ""}</p></TD>
                <TD>{x.attendance ? <Badge variant={x.attendance === "ABSENT" ? "destructive" : x.attendance === "LATE" ? "warning" : "success"}>{x.attendance.toLowerCase()}</Badge> : <span className="text-xs text-muted-foreground">not joined</span>}</TD>
                <TD className="text-xs text-muted-foreground">{x.runs} runs{x.lastSaved ? ` · saved ${new Date(x.lastSaved).toLocaleTimeString("en-IN")}` : ""}</TD>
                <TD className="text-xs">{x.submission ? <>{new Date(x.submission.submittedAt).toLocaleTimeString("en-IN")} {x.submission.isLate && <Badge variant="warning">late</Badge>} {x.submission.status === "REOPENED" && <Badge variant="warning">reopened</Badge>}</> : "—"}</TD>
                <TD>{x.submission?.verdict ? <span className="flex items-center gap-2"><VerdictBadge v={x.submission.verdict} /><span className="text-xs">{x.submission.tests}</span></span> : "—"}</TD>
                <TD className="space-x-1 whitespace-nowrap text-right">
                  {s.status !== "ENDED" && <Button size="sm" variant="ghost" onClick={() => extend(x.id)}>+ time</Button>}
                  {x.submission && x.submission.status !== "REOPENED" && <Button size="sm" variant="ghost" onClick={() => reopen(x.id)}>Reopen</Button>}
                  {x.submission && <Link className="text-xs font-medium text-primary hover:underline" href={`/faculty/review/${x.submission.id}`}>Review</Link>}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
