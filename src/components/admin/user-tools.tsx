"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Alert } from "@/components/ui";

export function ResetPasswordButton({ userId, disabled }: { userId: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  async function go() {
    if (!window.confirm("Issue a temporary password? The user is signed out everywhere.")) return;
    setBusy(true);
    const r = await fetch(`/api/v1/admin/users/${userId}/reset-password`, { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? { tone: "success", text: `Temporary password (shown once): ${d.tempPassword}` } : { tone: "error", text: d.error ?? "Failed." });
  }
  return <div className="space-y-2"><Button variant="outline" onClick={go} loading={busy} disabled={disabled}>Reset password</Button>{msg && <Alert tone={msg.tone}><span className="select-all font-mono">{msg.text}</span></Alert>}</div>;
}

export function UserImport() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ created: { email: string; tempPassword: string }[]; errors: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function go(e: React.FormEvent) {
    e.preventDefault(); if (!file) return;
    setBusy(true); setErr(null); setRes(null);
    const fd = new FormData(); fd.set("file", file);
    const r = await fetch("/api/v1/admin/users/import", { method: "POST", body: fd });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(d.error ?? "Import failed."); return; }
    setRes(d); router.refresh();
  }
  function download() {
    if (!res) return;
    const csv = "email,temporary_password\n" + res.created.map((c) => `${c.email},${c.tempPassword}`).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "new-accounts.csv"; a.click();
  }
  return (
    <form onSubmit={go} className="space-y-3">
      <div className="flex flex-wrap gap-2"><Input type="file" accept=".csv" aria-label="Users CSV" className="max-w-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><Button type="submit" loading={busy} disabled={!file}>Import</Button></div>
      <p className="text-xs text-muted-foreground">Columns: name, email, role (STUDENT, FACULTY, HOD), enrollment_no, employee_id, batch_code.</p>
      {err && <Alert tone="error">{err}</Alert>}
      {res && <Alert tone={res.errors.length ? "warning" : "success"}>
        Created {res.created.length} account(s).{res.created.length > 0 && <> <button type="button" className="font-medium underline" onClick={download}>Download temporary passwords</button> (shown only now).</>}
        {res.errors.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs">{res.errors.slice(0, 20).map((x) => <li key={x}>{x}</li>)}</ul>}
      </Alert>}
    </form>
  );
}
