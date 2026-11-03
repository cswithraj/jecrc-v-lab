import { route, forbidden } from "@/lib/api";
import { canManageOffering } from "@/lib/rbac";
import { previewResults, storedResults } from "@/lib/services/results";

/** GET /api/v1/offerings/:id/results — stored results plus a live preview of what a recompute would give (staff). */
export const GET = route<{ id: string }>({ permission: "results.finalize" }, async (_req, { user, params }) => {
  if (!(await canManageOffering(user, params.id))) throw forbidden();
  const [preview, stored] = await Promise.all([previewResults(params.id), storedResults(params.id)]);
  return { preview, stored };
});
