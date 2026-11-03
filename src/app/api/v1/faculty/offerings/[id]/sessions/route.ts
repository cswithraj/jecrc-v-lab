import { route, forbidden } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageOffering } from "@/lib/rbac";

/** GET /api/v1/faculty/offerings/:id/sessions — all practicals of a class. */
export const GET = route<{ id: string }>({ permission: "sessions.manage" }, async (_req, { user, params }) => {
  if (!(await canManageOffering(user, params.id))) throw forbidden();
  return { items: await prisma.practicalSession.findMany({ where: { offeringId: params.id }, orderBy: { sequence: "asc" }, include: { experiment: { select: { title: true, number: true } }, _count: { select: { submissions: true } } } }) };
});
