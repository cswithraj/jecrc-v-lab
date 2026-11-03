import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";

const Body = z.object({ ids: z.array(z.string()).max(200).optional(), all: z.boolean().optional() });

/** POST /api/v1/notifications/read { ids?: string[], all?: true } — mark own notifications read. */
export const POST = route({}, async (req, { user }) => {
  const b = await parseBody(req, Body);
  const r = await prisma.notification.updateMany({ where: { userId: user.id, readAt: null, ...(b.all ? {} : { id: { in: b.ids ?? [] } }) }, data: { readAt: new Date() } });
  return { updated: r.count };
});
