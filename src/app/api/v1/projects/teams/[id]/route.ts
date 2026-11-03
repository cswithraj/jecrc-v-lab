import { route } from "@/lib/api";
import { loadTeam, deleteTeam } from "@/lib/services/projects";

/** GET /api/v1/projects/teams/:id — team, project brief, milestones, submissions (members and managing staff). */
export const GET = route<{ id: string }>({}, async (_req, { user, params }) => (await loadTeam(user, params.id)).team);
/** DELETE /api/v1/projects/teams/:id — staff; not allowed once evaluated. */
export const DELETE = route<{ id: string }>({ permission: "marks.manage" }, async (_req, { user, params }) => { await deleteTeam(user, params.id); return { ok: true }; });
