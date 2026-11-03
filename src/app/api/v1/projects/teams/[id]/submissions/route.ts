import { route } from "@/lib/api";
import { SubmissionInput, addSubmission } from "@/lib/services/projects";

/** POST /api/v1/projects/teams/:id/submissions (multipart: kind, url?, notes?, milestoneId?, file?) — team members. */
export const POST = route<{ id: string }>({}, async (req, { user, params }) => {
  const f = await req.formData();
  const val = (k: string) => { const v = f.get(k); return typeof v === "string" && v.trim() ? v : undefined; };
  const input = SubmissionInput.parse({ kind: val("kind"), url: val("url"), notes: val("notes"), milestoneId: val("milestoneId") });
  const file = f.get("file");
  return addSubmission(user, params.id, input, file instanceof File ? file : null);
});
