import { route } from "@/lib/api";
import { loadSubmission, studentView } from "@/lib/services/review";

/** GET /api/v1/submissions/:id — students: own only (marks after release); staff: if they manage the class. */
export const GET = route<{ id: string }>({}, async (_req, { user, params }) => {
  const sub = await loadSubmission(user, params.id);
  return user.role === "STUDENT" ? studentView(sub) : sub;
});
