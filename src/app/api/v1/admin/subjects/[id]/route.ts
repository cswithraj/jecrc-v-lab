import { route, parseBody } from "@/lib/api";
import { SubjectUpdate, updateSubject } from "@/lib/services/admin";

/** PATCH /api/v1/admin/subjects/:id — credits, required practicals, difficulty targets, timing, status. */
export const PATCH = route<{ id: string }>({ permission: "academics.manage" }, async (req, { user, params }) => updateSubject(user, params.id, await parseBody(req, SubjectUpdate)));
