import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { setSubjectFaculty } from "@/lib/services/admin";

const Body = z.object({ userIds: z.array(z.string()).max(20) });
/** PUT /api/v1/admin/subjects/:id/faculty — replace the faculty assigned to a laboratory (first = coordinator). */
export const PUT = route<{ id: string }>({ permission: "academics.manage" }, async (req, { user, params }) => { await setSubjectFaculty(user, params.id, (await parseBody(req, Body)).userIds); return { ok: true }; });
