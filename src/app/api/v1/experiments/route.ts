import type { Prisma } from "@prisma/client";
import { route, parseBody, pageParams } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isStaff } from "@/lib/rbac";
import { ExperimentInput, createExperiment } from "@/lib/services/experiments";

/**
 * GET /api/v1/experiments?subject=slug&q=&difficulty=&topic=&language=&status=&page=&pageSize=
 * Students only ever see PUBLISHED experiments; reference code and hidden tests are never listed.
 */
export const GET = route({}, async (req, { user }) => {
  const url = new URL(req.url);
  const sp = url.searchParams;
  const { skip, take, page, pageSize } = pageParams(url);
  const where: Prisma.ExperimentWhereInput = {};
  if (sp.get("subject")) where.subject = { slug: sp.get("subject")! };
  if (sp.get("difficulty")) where.difficulty = sp.get("difficulty") as never;
  if (sp.get("language")) where.language = sp.get("language") as never;
  if (sp.get("topic")) where.topic = { name: sp.get("topic")! };
  if (sp.get("q")) where.title = { contains: sp.get("q")!, mode: "insensitive" };
  where.status = isStaff(user) ? (sp.get("status") as never) ?? undefined : "PUBLISHED";
  const [items, total] = await Promise.all([
    prisma.experiment.findMany({ where, orderBy: [{ subjectId: "asc" }, { number: "asc" }], skip, take, select: { id: true, code: true, number: true, title: true, difficulty: true, language: true, status: true, estimatedMinutes: true, subject: { select: { slug: true, name: true } }, topic: { select: { name: true } } } }),
    prisma.experiment.count({ where }),
  ]);
  return { items, total, page, pageSize };
});

/** POST /api/v1/experiments — create (as draft). */
export const POST = route({ permission: "experiments.manage" }, async (req, { user }) => createExperiment(user, await parseBody(req, ExperimentInput)));
