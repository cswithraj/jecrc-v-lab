import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { managedOfferings } from "@/lib/services/offerings";
import { PageHeader, Card, CardHeader, CardTitle, CardContent, EmptyState, Badge } from "@/components/ui";
import { Pagination } from "@/components/common/pagination";
import { ActionButton } from "@/components/common/action-button";
import { AnnounceForm } from "@/components/account/announce-form";
import { fmtDateTime, cn } from "@/lib/utils";

export const metadata = { title: "Notifications" };
const PAGE = 30;
const TYPE: Record<string, string> = { SESSION_UPCOMING: "practical", ASSIGNMENT: "assignment", DEADLINE: "deadline", MARKS_RELEASED: "marks", MISSED_SESSION: "missed", PROJECT_DEADLINE: "project", ANNOUNCEMENT: "announcement", RESULT_PUBLISHED: "result" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page || 1));
  const where = { userId: user.id, ...(sp.show === "unread" ? { readAt: null } : {}) };
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  const staff = user.role !== "STUDENT";
  const offerings = staff ? await managedOfferings(user) : [];
  return (
    <>
      <PageHeader eyebrow="Overview" title="Notifications" description={`${unread} unread`}
        actions={unread > 0 ? <ActionButton url="/api/v1/notifications/read" body={{ all: true }} variant="outline">Mark all as read</ActionButton> : undefined} />
      <div className={cn("grid gap-6", staff && "xl:grid-cols-[1fr_360px]")}>
        <div>
          <div className="mb-3 flex gap-3 text-sm">
            <Link href="/notifications" className={cn("font-medium", sp.show !== "unread" ? "text-primary" : "text-muted-foreground hover:text-foreground")}>All</Link>
            <Link href="/notifications?show=unread" className={cn("font-medium", sp.show === "unread" ? "text-primary" : "text-muted-foreground hover:text-foreground")}>Unread</Link>
          </div>
          <Card>
            {items.length === 0 ? <div className="p-6"><EmptyState title="No notifications" description="Practical reminders, released marks and announcements appear here." /></div> : (
              <ul className="divide-y">
                {items.map((n) => (
                  <li key={n.id} className={cn("flex gap-3 px-5 py-4", !n.readAt && "bg-primary/[0.03]")}>
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-label={n.readAt ? undefined : "unread"} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium">{n.title} <Badge variant="secondary">{TYPE[n.type] ?? n.type.toLowerCase()}</Badge></p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                      <p className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">{fmtDateTime(n.createdAt)}{n.link && <Link className="font-medium text-primary hover:underline" href={n.link}>Open</Link>}</p>
                    </div>
                    {!n.readAt && <ActionButton url="/api/v1/notifications/read" body={{ ids: [n.id] }} size="sm" variant="ghost">Mark read</ActionButton>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Pagination page={page} pageSize={PAGE} total={total} params={sp} />
        </div>
        {staff && offerings.length > 0 && (
          <Card className="h-fit">
            <CardHeader><CardTitle>Send an announcement</CardTitle></CardHeader>
            <CardContent><AnnounceForm offerings={offerings.map((o) => ({ id: o.id, label: `${o.subject.shortName} · ${o.batch.code}` }))} /></CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
