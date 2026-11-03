import { route, parseBody, notFound } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isStaff, canManageSubject } from "@/lib/rbac";
import { ExperimentInput, updateExperiment, deleteExperiment } from "@/lib/services/experiments";

type P = { id: string };

/** GET /api/v1/experiments/:id — full record for managing staff; student-safe view otherwise. */
export const GET = route<P>({}, async (_req, { user, params }) => {
  const e = await prisma.experiment.findUnique({ where: { id: params.id }, include: { testCases: { orderBy: { order: "asc" } }, vivaQs: { orderBy: { order: "asc" } }, topic: true, versions: { select: { version: true, createdAt: true, editedById: true }, orderBy: { version: "desc" } } } });
  if (!e || (e.status !== "PUBLISHED" && !isStaff(user))) throw notFound();
  if (isStaff(user) && (await canManageSubject(user, e.subjectId))) return e;
  const { referenceCode, testCases, versions: _v, ...safe } = e;
  return { ...safe, referenceCode: e.showSolution ? referenceCode : null, testCases: testCases.filter((t) => !t.isHidden), hiddenTestCount: testCases.filter((t) => t.isHidden).length };
});

/** PUT /api/v1/experiments/:id — full update; previous version is kept in history. */
export const PUT = route<P>({ permission: "experiments.manage" }, async (req, { user, params }) => updateExperiment(user, params.id, await parseBody(req, ExperimentInput)));

/** DELETE /api/v1/experiments/:id — deletes, or archives if it has sessions/submissions. */
export const DELETE = route<P>({ permission: "experiments.manage" }, async (_req, { user, params }) => deleteExperiment(user, params.id));
