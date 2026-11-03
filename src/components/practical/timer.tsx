"use client";
import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const WARN_AT = [30, 15, 5, 1];

/**
 * Countdown driven by the server's clock: offset = serverNow − clientNow at each sync,
 * so changing the device clock cannot add time. Re-syncs every 30 s via `sync`.
 */
export function PracticalTimer({ deadline, serverNow, sync, onExpire, onWarn }: { deadline: string | null; serverNow: string; sync?: () => void; onExpire?: () => void; onWarn?: (min: number) => void }) {
  const offset = useRef(new Date(serverNow).getTime() - Date.now());
  const fired = useRef(new Set<number>());
  const expired = useRef(false);
  const [now, setNow] = useState(() => Date.now() + offset.current);
  useEffect(() => { offset.current = new Date(serverNow).getTime() - Date.now(); }, [serverNow]);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now() + offset.current), 250);
    const re = sync ? setInterval(sync, 30_000) : null;
    return () => { clearInterval(tick); if (re) clearInterval(re); };
  }, [sync]);
  const remaining = deadline ? Math.max(0, new Date(deadline).getTime() - now) : 0;
  const mins = remaining / 60000;
  useEffect(() => {
    if (!deadline) return;
    for (const w of WARN_AT) if (mins <= w && mins > w - 0.5 && !fired.current.has(w)) { fired.current.add(w); onWarn?.(w); }
    if (remaining === 0 && !expired.current) { expired.current = true; onExpire?.(); }
  }, [mins, remaining, deadline, onWarn, onExpire]);
  const h = Math.floor(remaining / 3600000), m = Math.floor((remaining % 3600000) / 60000), s = Math.floor((remaining % 60000) / 1000);
  const tone = mins <= 5 ? "bg-destructive text-destructive-foreground" : mins <= 15 ? "bg-warning text-white" : "bg-secondary text-secondary-foreground";
  return (
    <div className={cn("flex items-center gap-2 rounded-md px-3 py-1.5 font-mono text-lg font-semibold tabular-nums", tone)} role="timer" aria-live="off" aria-label={`Time remaining ${h} hours ${m} minutes ${s} seconds`}>
      <Clock className="h-4 w-4" />
      {h > 0 && `${h}:`}{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </div>
  );
}
