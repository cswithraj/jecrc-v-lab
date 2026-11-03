"use client";
import { useState } from "react";
import { Button, Input, Textarea, Select, Field, Alert } from "@/components/ui";

export function AnnounceForm({ offerings }: { offerings: { id: string; label: string }[] }) {
  const [f, setF] = useState({ offeringId: offerings[0]?.id ?? "", title: "", body: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = await fetch("/api/v1/notifications/announce", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg({ tone: "error", text: d.error ?? "Could not send." }); return; }
    setF({ ...f, title: "", body: "" }); setMsg({ tone: "success", text: "Announcement sent to every student in the class." });
  }
  return (
    <form onSubmit={send} className="space-y-3">
      <Field label="Class" htmlFor="an-o"><Select id="an-o" value={f.offeringId} onChange={(e) => setF({ ...f, offeringId: e.target.value })}>{offerings.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select></Field>
      <Field label="Title" htmlFor="an-t"><Input id="an-t" required minLength={3} maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Message" htmlFor="an-b"><Textarea id="an-b" required minLength={3} maxLength={2000} rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
      <Button type="submit" loading={busy} disabled={!f.offeringId}>Send announcement</Button>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </form>
  );
}
