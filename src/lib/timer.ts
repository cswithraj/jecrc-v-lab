// Server-authoritative practical timer. The browser clock is never trusted:
// clients receive `serverNow` and `deadline` and only render a countdown from the offset.

export const SUBMIT_GRACE_MS = 15_000; // network latency allowance after the deadline
export const WARNING_MINUTES = [30, 15, 5, 1];

export interface SessionTiming {
  status: "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";
  startedAt: Date | null;
  endsAt: Date | null;
}

/** Personal deadline = session end + granted extensions + standing accommodation. */
export function personalDeadline(s: SessionTiming, extensionMinutes: number, extraTimeMinutes: number): Date | null {
  if (!s.endsAt) return null;
  return new Date(s.endsAt.getTime() + (extensionMinutes + extraTimeMinutes) * 60_000);
}

export type SubmitWindow = { allowed: true; late: boolean } | { allowed: false; reason: string };

export function canSubmit(s: SessionTiming, deadline: Date | null, now: Date, allowLate: boolean): SubmitWindow {
  if (s.status === "CANCELLED") return { allowed: false, reason: "This practical session was cancelled." };
  if (s.status === "SCHEDULED" || !s.startedAt) return { allowed: false, reason: "The practical session has not been started by faculty yet." };
  if (!deadline) return { allowed: false, reason: "Session has no deadline configured." };
  const over = now.getTime() > deadline.getTime() + SUBMIT_GRACE_MS;
  if (!over) return { allowed: true, late: false };
  if (allowLate) return { allowed: true, late: true };
  return { allowed: false, reason: "The submission deadline for this practical has passed." };
}

export function remainingMs(deadline: Date | null, now: Date) {
  return deadline ? Math.max(0, deadline.getTime() - now.getTime()) : 0;
}
