import { route, parseBody } from "@/lib/api";
import { SubjectCreate, createSubject } from "@/lib/services/admin";

/** POST /api/v1/admin/subjects — new laboratory; required practicals default to credits × 15. */
export const POST = route({ permission: "academics.manage" }, async (req, { user }) => createSubject(user, await parseBody(req, SubjectCreate)));
