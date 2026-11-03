/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { InstitutionSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

/** Full university lockup, switching to the light-on-dark variant in dark mode. */
export function UniversityLogo({ inst, className }: { inst: InstitutionSettings; className?: string }) {
  if (!inst.logoUrl) return <span className="font-display text-xl font-bold">{inst.university}</span>;
  return (
    <>
      <img src={inst.logoUrl} alt={inst.university} className={cn("dark:hidden", className)} />
      <img src={inst.logoDarkUrl || inst.logoUrl} alt="" aria-hidden className={cn("hidden dark:block", className)} />
    </>
  );
}

/** Compact crest + platform name used in app chrome. */
export function BrandMark({ inst, href = "/", compact }: { inst: InstitutionSettings; href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label={`${inst.shortName} home`}>
      {inst.crestUrl ? <img src={inst.crestUrl} alt="" className="h-9 w-auto" /> : <span className="h-9 w-9 rounded bg-primary" />}
      {!compact && (
        <span className="leading-tight">
          <span className="block font-display text-lg font-bold tracking-tight">{inst.shortName}</span>
          <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{inst.university}</span>
        </span>
      )}
    </Link>
  );
}
