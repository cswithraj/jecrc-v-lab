import { z } from "zod";
import { route, parseBody, forbidden } from "@/lib/api";
import { canManageOffering } from "@/lib/rbac";
import { notifyOffering } from "@/lib/notify";
import { audit } from "@/lib/audit";

const Body = z.object({ offeringId: z.string(), title: z.string().trim().min(3).max(120), body: z.string().trim().min(3).max(2000), link: z.string().startsWith("/").max(300).optional() });

/** POST /api/v1/notifications/announce — staff announcement to every student in a class. */
export const POST = route({ permission: "sessions.manage" }, async (req, { user }) => {
  const b = await parseBody(req, Body);
  if (!(await canManageOffering(user, b.offeringId))) throw forbidden();
  await notifyOffering(b.offeringId, { type: "ANNOUNCEMENT", title: b.title, body: b.body, link: b.link });
  await audit({ actorId: user.id, action: "announcement.send", entityType: "SubjectOffering", entityId: b.offeringId, after: { title: b.title } });
  return { ok: true };
});
