"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea, Alert, Field } from "@/components/ui";
import { RUBRIC_LABELS, MANUAL_COMPONENTS, type RubricKey } from "@/lib/evaluation";

export function MarksForm({ submissionId, rubric, components, finalized, canEditFinal }: { submissionId: string; rubric: Record<RubricKey, number>; components: Record<RubricKey, number | null>; finalized: boolean; canEditFinal: boolean }) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries((Object.keys(RUBRIC_LABELS) as RubricKey[]).map((k) => [k, components[k] == null ? "" : String(components[k])])));
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const locked = finalized && !canEditFinal;
  const changed = (Object.keys(RUBRIC_LABELS) as RubricKey[]).filter((k) => vals[k] !== "" && Number(vals[k]) !== components[k]);
  const overriding = changed.some((k) => components[k] != null);
  const total = (Object.keys(RUBRIC_LABELS) as RubricKey[]).reduce((a, k) => a + (vals[k] === "" ? 0 : Number(vals[k])), 0);

  async function call(path: string, body?: object) {
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error + (d.details?.fieldErrors ? "" : ""));
    return d;
  }
  async function save() {
    setBusy("save"); setMsg(null);
    try {
      const d = await call(`/api/v1/submissions/${submissionId}/marks`, { components: Object.fromEntries(changed.map((k) => [k, Number(vals[k])])), reason: reason || undefined });
      setMsg({ tone: "success", text: d.overrides ? `Saved. ${d.overrides} override(s) recorded in the audit log.` : "Marks saved." });
      setReason(""); router.refresh();
    } catch (e) { setMsg({ tone: "error", text: (e as Error).message }); } finally { setBusy(null); }
  }
  async function act(kind: "finalize" | "feedback") {
    setBusy(kind); setMsg(null);
    try {
      await call(`/api/v1/submissions/${submissionId}/${kind}`, kind === "feedback" ? { comment: feedback } : undefined);
      setMsg({ tone: "success", text: kind === "feedback" ? "Feedback sent to the student." : "Submission finalized." });
      setFeedback(""); router.refresh();
    } catch (e) { setMsg({ tone: "error", text: (e as Error).message }); } finally { setBusy(null); }
  }

  return (
    <div className="space-y-4">
      {locked && <Alert tone="warning">Finalized. Only HOD or administrators can change these marks.</Alert>}
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-1">Component</th><th className="py-1 text-right">Marks</th><th className="w-14 py-1 text-right">Max</th></tr></thead>
        <tbody>
          {(Object.keys(RUBRIC_LABELS) as RubricKey[]).map((k) => (
            <tr key={k} className="border-t">
              <td className="py-1.5">{RUBRIC_LABELS[k]} <span className="text-xs text-muted-foreground">{(MANUAL_COMPONENTS as readonly string[]).includes(k) ? "faculty" : components[k] == null ? "faculty (no auto tests)" : "automatic"}</span></td>
              <td className="py-1.5 text-right"><Input aria-label={RUBRIC_LABELS[k]} type="number" step="0.5" min={0} max={rubric[k]} disabled={locked} value={vals[k]} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} className="ml-auto h-8 w-24 text-right" placeholder="—" /></td>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground">{rubric[k]}</td>
            </tr>
          ))}
          <tr className="border-t font-semibold"><td className="py-2">Total</td><td className="py-2 text-right tabular-nums">{Math.round(total * 100) / 100}</td><td className="py-2 text-right tabular-nums">{Object.values(rubric).reduce((a, b) => a + b, 0)}</td></tr>
        </tbody>
      </table>
      {overriding && <Field label="Reason for changing existing marks (required, audited)" htmlFor="reason"><Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[60px]" /></Field>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} loading={busy === "save"} disabled={locked || !changed.length || (overriding && reason.trim().length < 5)}>Save marks</Button>
        {!finalized && <Button variant="outline" onClick={() => act("finalize")} loading={busy === "finalize"}>Finalize</Button>}
      </div>
      <Field label="Feedback to student" htmlFor="fb"><Textarea id="fb" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What was done well and what to improve" /></Field>
      <Button variant="secondary" onClick={() => act("feedback")} loading={busy === "feedback"} disabled={feedback.trim().length < 2}>Send feedback</Button>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}
