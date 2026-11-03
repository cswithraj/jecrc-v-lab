"use client";
import { useState } from "react";
import { Button, Input, Field, Alert } from "@/components/ui";

export function PasswordForm({ disabled }: { disabled?: boolean }) {
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.next !== f.confirm) { setMsg({ tone: "error", text: "The new passwords do not match." }); return; }
    setBusy(true); setMsg(null);
    const r = await fetch("/api/v1/auth/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ current: f.current, next: f.next }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg({ tone: "error", text: d.error ?? "Could not change password." }); return; }
    setF({ current: "", next: "", confirm: "" });
    setMsg({ tone: "success", text: "Password changed. Other devices have been signed out." });
  }
  return (
    <form onSubmit={submit} className="max-w-sm space-y-3">
      <Field label="Current password" htmlFor="pw-c"><Input id="pw-c" type="password" autoComplete="current-password" required disabled={disabled} value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
      <Field label="New password" htmlFor="pw-n" hint="At least 8 characters with letters and numbers"><Input id="pw-n" type="password" autoComplete="new-password" required disabled={disabled} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
      <Field label="Confirm new password" htmlFor="pw-r"><Input id="pw-r" type="password" autoComplete="new-password" required disabled={disabled} value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
      <Button type="submit" loading={busy} disabled={disabled}>Change password</Button>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </form>
  );
}
