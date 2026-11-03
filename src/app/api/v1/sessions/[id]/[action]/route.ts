import { z } from "zod";
import { route, parseBody, notFound } from "@/lib/api";
import { releaseMarks } from "@/lib/services/review";
import { startSession, endSession, extendSession, reopenSubmission, monitor, joinSession, studentSessionStatus } from "@/lib/services/sessions";

type P = { id: string; action: string };
const Extend = z.object({ studentId: z.string().optional(), minutes: z.number().int().min(1).max(240), reason: z.string().trim().min(3).max(500) });
const Reopen = z.object({ studentId: z.string(), reason: z.string().trim().min(3).max(500) });

/**
 * POST /api/v1/sessions/:id/start | end | extend | reopen | release  (staff)
 * POST /api/v1/sessions/:id/join                          (student, records attendance)
 */
export const POST = route<P>({}, async (req, { user, params }) => {
  const staff = user.role !== "STUDENT";
  switch (params.action) {
    case "join": return joinSession(user, params.id);
    case "start": if (staff) return startSession(user, params.id); break;
    case "end": if (staff) return endSession(user, params.id); break;
    case "extend": if (staff) return extendSession(user, params.id, await parseBody(req, Extend)); break;
    case "reopen": if (staff) return reopenSubmission(user, params.id, await parseBody(req, Reopen)); break;
    case "release": if (staff) return releaseMarks(user, params.id); break;
  }
  throw notFound("Unknown action.");
});

/** GET /api/v1/sessions/:id/status (student timer sync) | monitor (staff live board) */
export const GET = route<P>({}, async (_req, { user, params }) => {
  if (params.action === "status" && user.role === "STUDENT") return studentSessionStatus(user, params.id);
  if (params.action === "monitor" && user.role !== "STUDENT") return monitor(user, params.id);
  throw notFound("Unknown action.");
});
