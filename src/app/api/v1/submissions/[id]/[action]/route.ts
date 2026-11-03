import { z } from "zod";
import { route, parseBody, notFound, clientIp } from "@/lib/api";
import { updateMarks, addFeedback, finalizeSubmission } from "@/lib/services/review";

const Marks = z.object({ components: z.record(z.string(), z.number()), reason: z.string().max(500).optional() });
const Feedback = z.object({ comment: z.string().trim().min(2).max(2000) });

/** POST /api/v1/submissions/:id/marks | feedback | finalize — staff evaluation actions. */
export const POST = route<{ id: string; action: string }>({ permission: "marks.manage" }, async (req, { user, params }) => {
  switch (params.action) {
    case "marks": { const b = await parseBody(req, Marks); return updateMarks(user, params.id, { components: b.components as never, reason: b.reason, ip: clientIp(req) }); }
    case "feedback": return addFeedback(user, params.id, (await parseBody(req, Feedback)).comment);
    case "finalize": return finalizeSubmission(user, params.id);
  }
  throw notFound("Unknown action.");
});
