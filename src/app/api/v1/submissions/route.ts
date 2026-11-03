import { z } from "zod";
import { route, parseBody, pageParams } from "@/lib/api";
import { prisma } from "@/lib/db";
import { submit } from "@/lib/services/code";
import { LanguageEnum } from "@/lib/schemas";

const Body = z.object({ language: LanguageEnum, code: z.string().min(1).max(65536), experimentId: z.string(), sessionId: z.string().nullish() });

/** POST /api/v1/submissions — graded submission (practical if sessionId, else practice). */
export const POST = route({ permission: "submissions.create" }, async (req, { user }) => submit(user, await parseBody(req, Body)));

/** GET /api/v1/submissions?experimentId=&page= — the current student's own submission history. */
export const GET = route({ roles: ["STUDENT"] }, async (req, { user }) => {
  const url = new URL(req.url);
  const { skip, take, page, pageSize } = pageParams(url);
  const where = { studentId: user.id, ...(url.searchParams.get("experimentId") ? { experimentId: url.searchParams.get("experimentId")! } : {}) };
  const now = new Date();
  const [rows, total] = await Promise.all([
    prisma.submission.findMany({ where, orderBy: { submittedAt: "desc" }, skip, take, select: { id: true, submittedAt: true, language: true, status: true, isLate: true, experiment: { select: { title: true, code: true } }, session: { select: { sequence: true, marksReleaseAt: true } }, evaluation: { select: { verdict: true, testsPassed: true, testsTotal: true, totalMarks: true, maxMarks: true } } } }),
    prisma.submission.count({ where }),
  ]);
  return {
    page, pageSize, total,
    items: rows.map((r) => {
      const released = !r.session || (r.session.marksReleaseAt != null && r.session.marksReleaseAt <= now);
      return { ...r, evaluation: r.evaluation ? { ...r.evaluation, totalMarks: released ? r.evaluation.totalMarks : null } : null, marksReleased: released };
    }),
  };
});
