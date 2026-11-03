import { route } from "@/lib/api";
import { setCurrentSession } from "@/lib/services/admin";

/** POST /api/v1/admin/sessions/:id/current — mark an academic session as the current one. */
export const POST = route<{ id: string }>({ permission: "academics.manage" }, async (_req, { user, params }) => { await setCurrentSession(user, params.id); return { ok: true }; });
