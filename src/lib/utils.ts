import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
export const round2 = (n: number) => Math.round(n * 100) / 100;
export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
}
export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" });
}
export function initials(name: string) { return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase(); }
