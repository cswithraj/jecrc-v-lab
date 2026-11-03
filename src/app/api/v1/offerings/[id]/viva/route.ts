import { z } from "zod";
import { route, parseBody, forbidden, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageOffering } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const Body = z.object({ marks: z.array(z.object({ studentId: z.string(), viva: z.number().min(0).max(100).nullable() })).min(1).max(500) });

/** PUT /api/v1/offerings/:id/viva — end-of-lab viva marks (out of 100) for students in the class. */
export const PUT = route<{ id: string }>({ permission: "marks.manage" }, async (req, { user, params }) => {
  if (!(await canManageOffering(user, params.id))) throw forbidden();
  const o = await prisma.subjectOffering.findUniqueOrThrow({ where: { id: params.id }, select: { resultsFinalized: true } });
  if (o.resultsFinalized) throw new ApiError(409, "Results are finalized; viva marks are locked.");
  const { marks } = await parseBody(req, Body);
  await prisma.$transaction(async (tx) => {
    for (const m of marks) {
      const before = await tx.studentEnrollment.findUnique({ where: { offeringId_studentId: { offeringId: params.id, studentId: m.studentId } }, select: { vivaMarks: true } });
      if (!before) throw new ApiError(400, "A student in the list is not enrolled in this class.");
      if (before.vivaMarks === m.viva) continue;
      await tx.studentEnrollment.update({ where: { offeringId_studentId: { offeringId: params.id, studentId: m.studentId } }, data: { vivaMarks: m.viva } });
      await audit({ actorId: user.id, action: "viva.update", entityType: "StudentEnrollment", entityId: `${params.id}:${m.studentId}`, before, after: { vivaMarks: m.viva } }, tx);
    }
  });
  return { ok: true };
});
