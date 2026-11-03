import { route, parseBody } from "@/lib/api";
import { CreateTeam, createTeam } from "@/lib/services/projects";

/** POST /api/v1/projects/teams — staff form a project team in a class. */
export const POST = route({ permission: "marks.manage" }, async (req, { user }) => createTeam(user, await parseBody(req, CreateTeam)));
