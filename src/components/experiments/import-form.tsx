"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Alert } from "@/components/ui";

export function ImportForm({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true); setErr(null); setRes(null);
    const fd = new FormData();
    fd.set("subjectId", subjectId); fd.set("file", file);
    const r = await fetch("/api/v1/experiments/import", { method: "POST", body: fd });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(d.error ?? "Import failed."); return; }
    setRes(d); router.refresh();
  }
  return (
    <form onSubmit={upload} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="file" accept=".csv,.xlsx" aria-label="Question bank file" className="max-w-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Button type="submit" loading={busy} disabled={!file}>Import</Button>
      </div>
      {err && <Alert tone="error">{err}</Alert>}
      {res && (
        <Alert tone={res.errors.length ? "warning" : "success"}>
          Created {res.created}, updated {res.updated} (imported rows are saved as drafts; updated rows keep a version history).
          {res.errors.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs">{res.errors.slice(0, 20).map((x) => <li key={x}>{x}</li>)}{res.errors.length > 20 && <li>…and {res.errors.length - 20} more</li>}</ul>}
        </Alert>
      )}
    </form>
  );
}
