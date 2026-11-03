"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Alert } from "@/components/ui";

/** Inline editor for end-of-lab viva marks (out of 100). Only changed rows are sent. */
export function VivaEditor({ offeringId, rows, locked }: { offeringId: string; rows: { studentId: string; name: string; enrollmentNo: string | null; viva: number | null }[]; locked: boolean }) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(rows.map((r) => [r.studentId, r.viva == null ? "" : String(r.viva)])));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const changed = rows.filter((r) => (vals[r.studentId] ?? "") !== (r.viva == null ? "" : String(r.viva)));
  const invalid = changed.some((r) => { const v = vals[r.studentId]; return v !== "" && (isNaN(Number(v)) || Number(v) < 0 || Number(v) > 100); });
  async function save() {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/v1/offerings/${offeringId}/viva`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ marks: changed.map((r) => ({ studentId: r.studentId, viva: vals[r.studentId] === "" ? null : Number(vals[r.studentId]) })) }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg({ tone: "error", text: d.error ?? "Could not save." }); return; }
    setMsg({ tone: "success", text: `Saved ${changed.length} viva mark(s).` });
    router.refresh();
  }
  return (
    <div>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <label key={r.studentId} className="flex items-center justify-between gap-3 border-b py-1.5 text-sm">
            <span className="min-w-0"><span className="block truncate font-medium">{r.name}</span><span className="text-xs text-muted-foreground">{r.enrollmentNo}</span></span>
            <Input type="number" min={0} max={100} step="0.5" inputMode="decimal" disabled={locked} aria-label={`Viva marks for ${r.name}`} className="h-8 w-20 text-right"
              value={vals[r.studentId] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [r.studentId]: e.target.value }))} placeholder="—" />
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={save} loading={busy} disabled={locked || changed.length === 0 || invalid}>Save viva marks{changed.length ? ` (${changed.length})` : ""}</Button>
        {invalid && <span className="text-xs text-destructive">Marks must be between 0 and 100.</span>}
        {locked && <span className="text-xs text-muted-foreground">Results are finalized, so viva marks are locked.</span>}
      </div>
      {msg && <Alert tone={msg.tone} className="mt-3">{msg.text}</Alert>}
    </div>
  );
}
