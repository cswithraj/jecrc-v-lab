import { route, pageParams } from "@/lib/api";
import { prisma } from "@/lib/db";

/** GET /api/v1/notifications?unread=1&page= — the current user's notifications, newest first. */
export const GET = route({}, async (req, { user }) => {
  const url = new URL(req.url);
  const { skip, take, page, pageSize } = pageParams(url, 50);
  const where = { userId: user.id, ...(url.searchParams.get("unread") ? { readAt: null } : {}) };
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return { items, total, unread, page, pageSize };
});
