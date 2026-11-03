import Link from "next/link";
import { Bell } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getInstitution } from "@/lib/settings";
import { Sidebar } from "@/components/shell/sidebar";
import { BrandMark } from "@/components/shell/brand";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { LogoutButton } from "@/components/shell/user-menu";
import { Badge } from "@/components/ui";
import { initials } from "@/lib/utils";

const ROLE_LABEL = { SUPER_ADMIN: "Super Admin", HOD: "HOD", FACULTY: "Faculty", STUDENT: "Student" } as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [inst, unread] = await Promise.all([getInstitution(), prisma.notification.count({ where: { userId: user.id, readAt: null } })]);
  return (
    <div className="min-h-screen">
      <Sidebar role={user.role} unread={unread} brand={<BrandMark inst={inst} href="/" />} />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-end gap-2 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          {user.isDemo && <Badge variant="warning" className="mr-auto ml-12 lg:ml-0">Demo account · sample data</Badge>}
          <Link href="/notifications" className="relative rounded-md p-2 hover:bg-muted" aria-label={`Notifications (${unread} unread)`}>
            <Bell className="h-4 w-4" />
            {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />}
          </Link>
          <ThemeToggle />
          <Link href="/profile" className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">{initials(user.name)}</span>
            <span className="hidden text-left leading-tight md:block">
              <span className="block text-sm font-medium">{user.name}</span>
              <span className="block text-xs text-muted-foreground">{ROLE_LABEL[user.role]}{user.enrollmentNo ? ` · ${user.enrollmentNo}` : ""}</span>
            </span>
          </Link>
          <LogoutButton />
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
