import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { startSoloProject } from "@/lib/services/projects";

const Body = z.object({ offeringId: z.string(), projectId: z.string() });
/** POST /api/v1/projects/start — a student starts an individual project. */
export const POST = route({ roles: ["STUDENT"] }, async (req, { user }) => { const b = await parseBody(req, Body); return startSoloProject(user, b.offeringId, b.projectId); });
