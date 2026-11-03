import { route } from "@/lib/api";
import { managedOfferings } from "@/lib/services/offerings";

/** GET /api/v1/faculty/offerings — classes the current staff member manages. */
export const GET = route({ permission: "sessions.manage" }, async (_req, { user }) => ({ items: await managedOfferings(user) }));
