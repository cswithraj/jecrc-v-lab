"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Field, Alert } from "@/components/ui";

export function TeamForm({ offeringId, projectId, maxSize, students, nextName }: { offeringId: string; projectId: string; maxSize: number; students: { id: string; name: string; enrollmentNo: string | null }[]; nextName: string }) {
  const router = useRouter();
  const [name, setName] = useState(nextName);
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < maxSize ? [...s, id] : s));
  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const r = await fetch("/api/v1/projects/teams", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ offeringId, projectId, name, studentIds: sel }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(d.error ?? "Could not create the team."); return; }
    setSel([]); setName(""); router.refresh();
  }
  if (!students.length) return <p className="text-sm text-muted-foreground">Every student in this class is already in a team.</p>;
  return (
    <form onSubmit={create} className="space-y-3">
      <Field label="Team name" htmlFor="tm-n"><Input id="tm-n" required value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Members ({sel.length}/{maxSize}; the first selected is the leader)</legend>
        <div className="max-h-64 space-y-1 overflow-auto rounded-md border p-2">
          {students.map((s) => (
            <label key={s.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
              <input type="checkbox" checked={sel.includes(s.id)} disabled={!sel.includes(s.id) && sel.length >= maxSize} onChange={() => toggle(s.id)} />
              <span className="flex-1">{s.name}</span><span className="text-xs text-muted-foreground">{s.enrollmentNo}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" loading={busy} disabled={!sel.length || !name.trim()}>Create team</Button>
      {err && <Alert tone="error">{err}</Alert>}
    </form>
  );
}
