import { route } from "@/lib/api";
import { resetPassword } from "@/lib/services/admin";

/** POST /api/v1/admin/users/:id/reset-password — issues a temporary password and signs the user out everywhere. */
export const POST = route<{ id: string }>({ permission: "users.manage" }, async (_req, { user, params }) => resetPassword(user, params.id));
