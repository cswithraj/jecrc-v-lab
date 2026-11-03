"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Field, Alert } from "@/components/ui";

type Band = { grade: string; min: number; points: number };
export function PolicyForm({ initial }: { initial: { name: string; weights: Record<string, number>; bands: Band[]; passPercent: number; minAttendancePercent: number; tieBreak: string[] } }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const wsum = Object.values(p.weights).reduce((a, b) => a + Number(b || 0), 0);
  async function save() {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/v1/admin/grading", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { const fe = d.details?.fieldErrors ? Object.values(d.details.fieldErrors).flat().join(" ") : ""; setMsg({ tone: "error", text: `${d.error ?? "Failed."} ${fe}` }); return; }
    setMsg({ tone: "success", text: "Policy saved. It applies to results computed from now on; finalized results are unchanged." }); router.refresh();
  }
  const LABEL: Record<string, string> = { experiments: "Practicals", project: "Project", viva: "Viva", attendance: "Attendance" };
  return (
    <div className="space-y-5">
      <Field label="Policy name" htmlFor="pl-n"><Input id="pl-n" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
      <div>
        <p className="mb-2 text-sm font-medium">Weights (must total 100; now <span className={wsum === 100 ? "text-success" : "text-destructive"}>{wsum}</span>)</p>
        <div className="grid gap-3 sm:grid-cols-4">{Object.keys(LABEL).map((k) => <Field key={k} label={LABEL[k]} htmlFor={`w-${k}`}><Input id={`w-${k}`} type="number" min={0} max={100} value={p.weights[k] ?? 0} onChange={(e) => setP({ ...p, weights: { ...p.weights, [k]: Number(e.target.value) } })} /></Field>)}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Pass mark (%)" htmlFor="pl-p"><Input id="pl-p" type="number" min={0} max={100} value={p.passPercent} onChange={(e) => setP({ ...p, passPercent: Number(e.target.value) })} /></Field>
        <Field label="Minimum attendance (%)" htmlFor="pl-a" hint="Below this a student is detained"><Input id="pl-a" type="number" min={0} max={100} value={p.minAttendancePercent} onChange={(e) => setP({ ...p, minAttendancePercent: Number(e.target.value) })} /></Field>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Grade bands (score at or above the minimum earns the grade)</p>
        <div className="space-y-2">{p.bands.map((b, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
            <Input aria-label="Grade" value={b.grade} onChange={(e) => setP({ ...p, bands: p.bands.map((x, j) => (j === i ? { ...x, grade: e.target.value } : x)) })} />
            <Input aria-label="Minimum score" type="number" min={0} max={100} value={b.min} onChange={(e) => setP({ ...p, bands: p.bands.map((x, j) => (j === i ? { ...x, min: Number(e.target.value) } : x)) })} />
            <Input aria-label="Grade points" type="number" min={0} max={10} value={b.points} onChange={(e) => setP({ ...p, bands: p.bands.map((x, j) => (j === i ? { ...x, points: Number(e.target.value) } : x)) })} />
            <Button type="button" variant="ghost" onClick={() => setP({ ...p, bands: p.bands.filter((_, j) => j !== i) })}>Remove</Button>
          </div>))}
          <Button type="button" variant="outline" size="sm" onClick={() => setP({ ...p, bands: [...p.bands, { grade: "", min: 0, points: 0 }] })}>Add band</Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Columns: grade, minimum score, grade points.</p>
      </div>
      <Field label="Tie-break order" htmlFor="pl-t" hint="Comma-separated: weightedScore, experimentAvg, projectMarks, vivaMarks, attendancePercent. Students equal on all keys share a rank.">
        <Input id="pl-t" value={p.tieBreak.join(", ")} onChange={(e) => setP({ ...p, tieBreak: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
      </Field>
      <Button onClick={save} loading={busy}>Save policy</Button>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}
