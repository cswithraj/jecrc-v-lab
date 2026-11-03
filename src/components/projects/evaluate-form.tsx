"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea, Field, Alert } from "@/components/ui";

export function EvaluateForm({ teamId, rubric, labels, initial, maxMarks, locked }: { teamId: string; rubric: Record<string, number>; labels: Record<string, string>; initial: Record<string, number | string> | null; maxMarks: number; locked: boolean }) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(Object.keys(rubric).map((k) => [k, initial?.[k] != null ? String(initial[k]) : ""])));
  const [feedback, setFeedback] = useState(typeof initial?.feedback === "string" ? initial.feedback : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const weight = Object.values(rubric).reduce((a, b) => a + b, 0) || 1;
  const filled = Object.keys(rubric).every((k) => vals[k] !== "" && !isNaN(Number(vals[k])));
  const total = Object.keys(rubric).reduce((a, k) => a + (Number(vals[k]) || 0), 0);
  async function save() {
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/v1/projects/teams/${teamId}/evaluate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ evaluation: Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, Number(v)])), feedback: feedback || undefined }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg({ tone: "error", text: d.error ?? "Could not save." }); return; }
    setMsg({ tone: "success", text: "Evaluation saved and the team has been notified." }); router.refresh();
  }
  return (
    <div className="space-y-3">
      {Object.entries(rubric).map(([k, max]) => (
        <div key={k} className="flex items-center justify-between gap-3 text-sm">
          <label htmlFor={`ev-${k}`} className="flex-1">{labels[k] ?? k}</label>
          <Input id={`ev-${k}`} type="number" min={0} max={max} step="0.5" className="h-8 w-20 text-right" disabled={locked} value={vals[k]} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />
          <span className="w-10 text-right text-muted-foreground tabular-nums">/ {max}</span>
        </div>
      ))}
      <p className="flex justify-between border-t pt-2 text-sm font-semibold"><span>Total</span><span className="tabular-nums">{Math.round((total / weight) * maxMarks * 100) / 100} / {maxMarks}</span></p>
      <Field label="Feedback to the team" htmlFor="ev-f"><Textarea id="ev-f" rows={3} disabled={locked} value={feedback} onChange={(e) => setFeedback(e.target.value)} /></Field>
      <Button onClick={save} loading={busy} disabled={!filled || locked}>Save evaluation</Button>
      {locked && <p className="text-xs text-muted-foreground">Results for this class are finalized, so project marks are locked.</p>}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}
