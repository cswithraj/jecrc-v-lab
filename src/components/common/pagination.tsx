import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({ page, pageSize, total, params }: { page: number; pageSize: number; total: number; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="mt-3 text-xs text-muted-foreground">{total} result{total === 1 ? "" : "s"}</p>;
  const href = (p: number) => "?" + new URLSearchParams({ ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)) as Record<string, string>, page: String(p) }).toString();
  return (
    <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
      <p className="text-muted-foreground">{(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} of {total}</p>
      <div className="flex items-center gap-1">
        <Link aria-disabled={page <= 1} href={href(Math.max(1, page - 1))} className={cn("rounded-md border p-1.5", page <= 1 && "pointer-events-none opacity-40")}><ChevronLeft className="h-4 w-4" /><span className="sr-only">Previous</span></Link>
        <span className="px-2 tabular-nums">Page {page} / {pages}</span>
        <Link aria-disabled={page >= pages} href={href(Math.min(pages, page + 1))} className={cn("rounded-md border p-1.5", page >= pages && "pointer-events-none opacity-40")}><ChevronRight className="h-4 w-4" /><span className="sr-only">Next</span></Link>
      </div>
    </nav>
  );
}
