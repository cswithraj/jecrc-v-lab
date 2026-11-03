"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Language } from "@prisma/client";
import { Alert, Badge } from "@/components/ui";
import { CodeWorkspace } from "@/components/editor/workspace";
import { PracticalTimer } from "./timer";

export interface PracticalStatus {
  status: "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED"; serverNow: string; deadline: string | null; extensionMinutes: number; extraTimeMinutes: number;
  canSubmit: boolean; allowLate: boolean; submission: { id: string; submittedAt: string; status: string; isLate: boolean } | null;
}

export function StudentPractical({ sessionId, experimentId, languages, initial, starter, hasPublicTests, autosaveSeconds, initialStatus, scheduledStart }: {
  sessionId: string; experimentId: string; languages: Language[]; initial: Partial<Record<Language, string>>; starter: Partial<Record<Language, string>>;
  hasPublicTests: boolean; autosaveSeconds: number; initialStatus: PracticalStatus; scheduledStart: string;
}) {
  const router = useRouter();
  const [st, setSt] = useState(initialStatus);
  const [toast, setToast] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const sync = useCallback(async () => {
    try {
      const r = await fetch(`/api/v1/sessions/${sessionId}/${st.status === "LIVE" ? "join" : "status"}`, { method: st.status === "LIVE" ? "POST" : "GET", cache: "no-store" });
      if (r.ok) { const d = await r.json(); setSt(d); setOffline(false); if (d.status !== st.status) router.refresh(); }
    } catch { setOffline(true); }
  }, [sessionId, st.status, router]);

  useEffect(() => { fetch(`/api/v1/sessions/${sessionId}/join`, { method: "POST" }).catch(() => {}); }, [sessionId]);
  // While waiting for faculty to start, poll every 10 s
  useEffect(() => {
    if (st.status !== "SCHEDULED") return;
    const id = setInterval(sync, 10_000);
    return () => clearInterval(id);
  }, [st.status, sync]);
  useEffect(() => {
    const on = () => { setOffline(false); sync(); };
    const off = () => setOffline(true);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [sync]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  if (st.status === "SCHEDULED") return <Alert>This practical has not started yet (scheduled {new Date(scheduledStart).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}). This page refreshes automatically when your faculty starts the session.</Alert>;
  if (st.status === "CANCELLED") return <Alert tone="warning">This practical session was cancelled.</Alert>;

  const submitted = st.submission && st.submission.status !== "REOPENED";
  const reason = submitted ? `Submitted at ${new Date(st.submission!.submittedAt).toLocaleTimeString("en-IN")}${st.submission!.isLate ? " (late)" : ""}. You can still run your code.` : !st.canSubmit ? (st.status === "ENDED" ? "This practical has ended. Submissions are closed." : "The deadline has passed. Submissions are closed.") : null;

  return (
    <div className="space-y-3">
      <div className="sticky top-16 z-10 -mx-1 flex flex-wrap items-center gap-3 rounded-md border bg-card/95 px-3 py-2 shadow-sm backdrop-blur">
        {st.status === "LIVE" ? <PracticalTimer deadline={st.deadline} serverNow={st.serverNow} sync={sync} onWarn={(m) => setToast(`${m} minute${m > 1 ? "s" : ""} remaining. Your code is autosaved — submit before the timer ends.`)} onExpire={() => { setToast("Time is up. Submissions are now closed unless faculty allow late submission."); sync(); }} /> : <Badge variant="secondary">Session ended</Badge>}
        {(st.extensionMinutes > 0 || st.extraTimeMinutes > 0) && <Badge variant="outline">+{st.extensionMinutes + st.extraTimeMinutes} min extra time</Badge>}
        {st.allowLate && <Badge variant="warning">Late submission allowed (flagged)</Badge>}
        {submitted ? <Badge variant="success">Submitted</Badge> : st.submission?.status === "REOPENED" ? <Badge variant="warning">Reopened for resubmission</Badge> : <Badge variant="secondary">Not submitted</Badge>}
        {offline && <Badge variant="destructive">Offline — work is kept on this device and saved when you reconnect</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">Timer is controlled by the server</span>
      </div>
      {toast && <Alert tone="warning" className="sticky top-32 z-10 shadow">{toast}</Alert>}
      <CodeWorkspace experimentId={experimentId} languages={languages} initial={initial} starter={starter} isStudent hasPublicTests={hasPublicTests} sessionId={sessionId} submitLabel="Submit practical" submitDisabledReason={reason} autosaveSeconds={autosaveSeconds} height="520px" onSubmitted={() => sync()} />
    </div>
  );
}
