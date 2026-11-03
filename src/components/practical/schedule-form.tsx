"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Select, Input, Alert } from "@/components/ui";

export function ScheduleForm({ offerings, defaultOffering }: { defaultOffering?: string; offerings: { id: string; label: string; experiments: { id: string; label: string }[] }[] }) {
  const router = useRouter();
  const [offeringId, setOfferingId] = useState(offerings.find((o) => o.id === defaultOffering)?.id ?? offerings[0]?.id ?? "");
  const exps = offerings.find((o) => o.id === offeringId)?.experiments ?? [];
  const [experimentId, setExperimentId] = useState("");
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState(120);
  const [release, setRelease] = useState("");
  const [allowLate, setAllowLate] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await fetch("/api/v1/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ offeringId, experimentId: experimentId || exps[0]?.id, scheduledStart: new Date(start).toISOString(), durationMin: duration, allowLate, marksReleaseAt: release ? new Date(release).toISOString() : null }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg({ tone: "error", text: d.error ?? "Could not schedule." }); return; }
    setMsg({ tone: "success", text: `Practical #${d.sequence} scheduled. Students have been notified.` });
    router.refresh();
  }
  if (!offerings.length) return <p className="text-sm text-muted-foreground">You have no classes assigned.</p>;
  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
      <Field label="Class" htmlFor="off"><Select id="off" value={offeringId} onChange={(e) => { setOfferingId(e.target.value); setExperimentId(""); }}>{offerings.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select></Field>
      <Field label="Experiment (published)" htmlFor="exp" className="md:col-span-2"><Select id="exp" value={experimentId} onChange={(e) => setExperimentId(e.target.value)}>{exps.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select></Field>
      <Field label="Date and start time" htmlFor="start"><Input id="start" type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} /></Field>
      <Field label="Duration (minutes)" htmlFor="dur" hint="Default 120"><Input id="dur" type="number" min={10} max={600} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></Field>
      <Field label="Release marks to students at" htmlFor="rel" hint="Leave empty to release manually later"><Input id="rel" type="datetime-local" value={release} onChange={(e) => setRelease(e.target.value)} /></Field>
      <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={allowLate} onChange={(e) => setAllowLate(e.target.checked)} /> Accept late submissions after the deadline (they are flagged and get half the submission marks)</label>
      <div className="md:text-right"><Button type="submit" loading={busy} disabled={!exps.length}>Schedule practical</Button></div>
      {msg && <Alert tone={msg.tone} className="md:col-span-3">{msg.text}</Alert>}
    </form>
  );
}
