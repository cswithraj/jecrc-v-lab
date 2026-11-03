import { route, badRequest } from "@/lib/api";
import { prisma } from "@/lib/db";
import { exportQuestionBank } from "@/lib/services/question-bank";

/** GET /api/v1/experiments/export?subjectId=&format=csv|xlsx&hidden=1 — question bank export. */
export const GET = route({ permission: "experiments.manage" }, async (req, { user }) => {
  const sp = new URL(req.url).searchParams;
  const subjectId = sp.get("subjectId");
  if (!subjectId) throw badRequest("subjectId is required.");
  const subject = await prisma.subject.findUniqueOrThrow({ where: { id: subjectId }, select: { code: true } });
  const out = await exportQuestionBank(user, subjectId, sp.get("format") === "xlsx" ? "xlsx" : "csv", sp.get("hidden") === "1");
  return new Response(out.body as BodyInit, { headers: { "content-type": out.type, "content-disposition": `attachment; filename="${subject.code}-question-bank.${out.ext}"` } });
});
