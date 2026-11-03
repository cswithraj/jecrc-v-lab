import { route, parseBody } from "@/lib/api";
import { UserUpdate, updateUser } from "@/lib/services/admin";

/** PATCH /api/v1/admin/users/:id — role, status, IDs, batch, extra exam time (audited). */
export const PATCH = route<{ id: string }>({ permission: "users.manage" }, async (req, { user, params }) => updateUser(user, params.id, await parseBody(req, UserUpdate)));
