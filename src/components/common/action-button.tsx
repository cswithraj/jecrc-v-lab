"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonProps } from "@/components/ui";

/**
 * Button that POSTs to an API endpoint, then refreshes server data.
 * `confirm` asks before acting; `reasonPrompt` asks for a mandatory reason (sent as { reason }).
 */
export function ActionButton({ url, method = "POST", body, confirm, reasonPrompt, children, onDone, ...props }: { url: string; method?: string; body?: unknown; confirm?: string; reasonPrompt?: string; onDone?: (data: unknown) => void } & Omit<ButtonProps, "onClick">) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function go() {
    if (confirm && !window.confirm(confirm)) return;
    let payload = body;
    if (reasonPrompt) {
      const reason = window.prompt(reasonPrompt)?.trim();
      if (!reason) return;
      payload = { ...(body as object), reason };
    }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: payload === undefined ? undefined : JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ ok: false, text: data.error ?? `Failed (${res.status})` }); return; }
      onDone?.(data);
      router.refresh();
    } catch { setMsg({ ok: false, text: "Network error. Try again." }); }
    finally { setBusy(false); }
  }
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button type="button" onClick={go} loading={busy} {...props}>{children}</Button>
      {msg && !msg.ok && <span role="alert" className="max-w-xs text-xs text-destructive">{msg.text}</span>}
    </span>
  );
}
