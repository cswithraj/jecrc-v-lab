"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Alert } from "@/components/ui";

export function FacultyPicker({ subjectId, faculty, assigned }: { subjectId: string; faculty: { id: string; name: string }[]; assigned: string[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<string[]>(assigned);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  async function save() {
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/v1/admin/subjects/${subjectId}/faculty`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ userIds: sel }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? { tone: "success", text: "Faculty updated." } : { tone: "error", text: d.error ?? "Failed." });
    if (r.ok) router.refresh();
  }
  return (
    <div className="space-y-3">
      <div className="max-h-72 space-y-1 overflow-auto rounded-md border p-2">
        {faculty.map((f) => (
          <label key={f.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
            <input type="checkbox" checked={sel.includes(f.id)} onChange={() => setSel((s) => (s.includes(f.id) ? s.filter((x) => x !== f.id) : [...s, f.id]))} />
            <span className="flex-1">{f.name}</span>{sel[0] === f.id && <span className="text-xs text-muted-foreground">coordinator</span>}
          </label>
        ))}
      </div>
      <Button onClick={save} loading={busy}>Save faculty</Button>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}
