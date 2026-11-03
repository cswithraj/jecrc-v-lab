import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { evaluateTeam } from "@/lib/services/projects";

const Body = z.object({ evaluation: z.record(z.string(), z.number()), feedback: z.string().trim().max(2000).optional() });
/** POST /api/v1/projects/teams/:id/evaluate — staff rubric marks; total and viva are derived. */
export const POST = route<{ id: string }>({ permission: "marks.manage" }, async (req, { user, params }) => { const b = await parseBody(req, Body); return evaluateTeam(user, params.id, b.evaluation, b.feedback); });
