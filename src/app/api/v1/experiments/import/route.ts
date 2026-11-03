import { route, badRequest } from "@/lib/api";
import { importQuestionBank } from "@/lib/services/question-bank";

/** POST /api/v1/experiments/import (multipart: subjectId, file=.csv|.xlsx) — bulk create/update as drafts. */
export const POST = route({ permission: "experiments.manage" }, async (req, { user }) => {
  const form = await req.formData();
  const subjectId = String(form.get("subjectId") ?? "");
  const file = form.get("file");
  if (!subjectId || !(file instanceof File)) throw badRequest("subjectId and file are required.");
  return importQuestionBank(user, subjectId, file);
});
