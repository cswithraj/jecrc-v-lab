"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea, Select, Field, Alert } from "@/components/ui";

export function SubmissionForm({ teamId, milestones, maxMb }: { teamId: string; milestones: { id: string; title: string }[]; maxMb: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file") as File | null;
    if (file && file.size > maxMb * 1024 * 1024) { setMsg({ tone: "error", text: `File is larger than ${maxMb} MB.` }); return; }
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/v1/projects/teams/${teamId}/submissions`, { method: "POST", body: fd });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg({ tone: "error", text: d.error === "Validation failed" ? "Check the link: it must be a full http(s) URL." : d.error ?? "Could not submit." }); return; }
    form.reset(); setMsg({ tone: "success", text: "Submitted." }); router.refresh();
  }
  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
      <Field label="Type" htmlFor="ps-k"><Select id="ps-k" name="kind" defaultValue="REPO"><option value="REPO">Code repository</option><option value="DOCUMENT">Report / document</option><option value="DEMO">Demo video or deployed app</option><option value="NOTE">Progress note</option></Select></Field>
      <Field label="Milestone" htmlFor="ps-m"><Select id="ps-m" name="milestoneId" defaultValue=""><option value="">Final submission</option>{milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</Select></Field>
      <Field label="Link" htmlFor="ps-u" className="md:col-span-2"><Input id="ps-u" name="url" type="url" placeholder="https://github.com/…" /></Field>
      <Field label="File (optional)" htmlFor="ps-f" hint={`PDF, ZIP, DOCX, PPTX, XLSX, images or text, up to ${maxMb} MB`}><Input id="ps-f" name="file" type="file" accept=".pdf,.zip,.docx,.pptx,.xlsx,.png,.jpg,.jpeg,.txt,.md" /></Field>
      <Field label="Notes" htmlFor="ps-n"><Textarea id="ps-n" name="notes" rows={3} /></Field>
      <div className="md:col-span-2 flex items-center gap-3"><Button type="submit" loading={busy}>Submit</Button>{msg && <Alert tone={msg.tone} className="flex-1">{msg.text}</Alert>}</div>
    </form>
  );
}
