import { route, notFound } from "@/lib/api";
import { createAcademic, Schemas } from "@/lib/services/admin";

/** POST /api/v1/admin/academics/departments | courses | sessions | batches */
export const POST = route<{ kind: string }>({ permission: "academics.manage" }, async (req, { user, params }) => {
  if (!(params.kind in Schemas)) throw notFound();
  return createAcademic(user, params.kind as keyof typeof Schemas, await req.json());
});
