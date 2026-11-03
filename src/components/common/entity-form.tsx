"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select, Textarea, Field, Alert } from "@/components/ui";
import { cn } from "@/lib/utils";

export type FieldSpec = {
  name: string; label: string; type?: "text" | "email" | "number" | "password" | "select" | "textarea" | "checkbox" | "date" | "color";
  options?: { value: string; label: string }[]; required?: boolean; hint?: string; placeholder?: string; min?: number; max?: number; step?: string; span?: 2 | 3;
};

/**
 * Small generic form: renders fields, sends JSON (numbers/booleans typed; empty optional values sent as null),
 * shows API errors, refreshes server data on success. `successText` may include {field} placeholders from the response.
 */
export function EntityForm({ fields, url, method = "POST", initial = {}, submitLabel = "Save", successText = "Saved.", resetOnSuccess = false, columns = 2, extra }: {
  fields: FieldSpec[]; url: string; method?: "POST" | "PUT" | "PATCH"; initial?: Record<string, unknown>; submitLabel?: string; successText?: string; resetOnSuccess?: boolean; columns?: 1 | 2 | 3; extra?: Record<string, unknown>;
}) {
  const router = useRouter();
  const init = () => Object.fromEntries(fields.map((f) => [f.name, initial[f.name] ?? (f.type === "checkbox" ? false : "")]));
  const [v, setV] = useState<Record<string, unknown>>(init);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string; details?: string[] } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const body: Record<string, unknown> = { ...extra };
    for (const f of fields) {
      const x = v[f.name];
      if (f.type === "checkbox") body[f.name] = Boolean(x);
      else if (f.type === "number") body[f.name] = x === "" || x == null ? null : Number(x);
      else body[f.name] = x === "" ? (f.required ? "" : null) : x;
    }
    const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      const fe = d.details?.fieldErrors as Record<string, string[]> | undefined;
      setMsg({ tone: "error", text: d.error ?? "Could not save.", details: fe ? Object.entries(fe).map(([k, m]) => `${fields.find((f) => f.name === k)?.label ?? k}: ${m.join(", ")}`) : undefined });
      return;
    }
    setMsg({ tone: "success", text: successText.replace(/\{(\w+)\}/g, (_, k) => String(d[k] ?? "")) });
    if (resetOnSuccess) setV(init());
    router.refresh();
  }

  const grid = columns === 3 ? "md:grid-cols-3" : columns === 2 ? "md:grid-cols-2" : "";
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className={cn("grid gap-3", grid)}>
        {fields.map((f) => {
          const id = `ef-${url.replace(/\W/g, "")}-${f.name}`;
          const span = f.span === 3 ? "md:col-span-3" : f.span === 2 ? "md:col-span-2" : "";
          const val = v[f.name];
          if (f.type === "checkbox") return <label key={f.name} className={cn("flex items-center gap-2 self-end pb-2 text-sm", span)}><input id={id} type="checkbox" checked={Boolean(val)} onChange={(e) => setV({ ...v, [f.name]: e.target.checked })} />{f.label}</label>;
          return (
            <Field key={f.name} label={f.label} htmlFor={id} hint={f.hint} className={span}>
              {f.type === "select" ? <Select id={id} required={f.required} value={String(val ?? "")} onChange={(e) => setV({ ...v, [f.name]: e.target.value })}>{!f.required && <option value="">—</option>}{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
                : f.type === "textarea" ? <Textarea id={id} required={f.required} rows={3} placeholder={f.placeholder} value={String(val ?? "")} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
                : <Input id={id} type={f.type ?? "text"} required={f.required} min={f.min} max={f.max} step={f.step} placeholder={f.placeholder} value={String(val ?? "")} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />}
            </Field>
          );
        })}
      </div>
      <Button type="submit" loading={busy}>{submitLabel}</Button>
      {msg && <Alert tone={msg.tone}>{msg.text}{msg.details && <ul className="mt-1 list-disc pl-5 text-xs">{msg.details.map((x) => <li key={x}>{x}</li>)}</ul>}</Alert>}
    </form>
  );
}
