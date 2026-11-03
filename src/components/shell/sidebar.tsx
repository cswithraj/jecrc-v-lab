"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Shield, Bell, FlaskConical, Terminal, Timer, FolderKanban, Trophy, Users, Library, ClipboardCheck,
  BarChart3, UserCog, Building2, BookOpen, Scale, Settings, ScrollText, User, Menu, X, type LucideIcon,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { NAV } from "./nav";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard, shield: Shield, bell: Bell, "flask-conical": FlaskConical, terminal: Terminal, timer: Timer,
  "folder-kanban": FolderKanban, trophy: Trophy, users: Users, library: Library, "clipboard-check": ClipboardCheck, "bar-chart-3": BarChart3,
  "user-cog": UserCog, "building-2": Building2, "book-open": BookOpen, scale: Scale, settings: Settings, "scroll-text": ScrollText, user: User,
};

export function Sidebar({ role, brand, unread }: { role: Role; brand: React.ReactNode; unread: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => path === href || (href.length > 8 && path.startsWith(href + "/"));
  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Main">
      {NAV.map((sec) => {
        const items = sec.items.filter((i) => i.roles.includes(role));
        if (!items.length) return null;
        return (
          <div key={sec.section}>
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{sec.section}</p>
            <ul className="space-y-0.5">
              {items.map((i) => {
                const Icon = ICONS[i.icon] ?? LayoutDashboard;
                const active = isActive(i.href);
                return (
                  <li key={i.href}>
                    <Link href={i.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                      className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors", active ? "bg-primary/10 font-medium text-primary" : "text-foreground/80 hover:bg-muted hover:text-foreground")}>
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{i.label}</span>
                      {i.href === "/notifications" && unread > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{unread}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
  return (
    <>
      <button className="fixed left-3 top-3 z-50 rounded-md border bg-card p-2 lg:hidden" onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-card transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="stripe flex h-16 items-center border-b pl-6 pr-4">{brand}</div>
        {nav}
      </aside>
    </>
  );
}
