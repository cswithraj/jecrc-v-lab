import { z } from "zod";
import { route, parseBody, forbidden, badRequest } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageOffering } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { notifyOffering } from "@/lib/notify";

const Create = z.object({
  offeringId: z.string(), experimentId: z.string(), scheduledStart: z.coerce.date(),
  durationMin: z.number().int().min(10).max(600).default(120), isAssessment: z.boolean().default(true), allowLate: z.boolean().default(false),
  marksReleaseAt: z.coerce.date().nullish(),
});

/** POST /api/v1/sessions — schedule a practical session for a class. */
export const POST = route({ permission: "sessions.manage" }, async (req, { user }) => {
  const body = await parseBody(req, Create);
  if (!(await canManageOffering(user, body.offeringId))) throw forbidden();
  const [offering, exp] = await Promise.all([
    prisma.subjectOffering.findUniqueOrThrow({ where: { id: body.offeringId }, include: { subject: true } }),
    prisma.experiment.findUnique({ where: { id: body.experimentId } }),
  ]);
  if (!exp || exp.subjectId !== offering.subjectId) throw badRequest("Experiment does not belong to this laboratory.");
  if (exp.status !== "PUBLISHED") throw badRequest("Publish the experiment before assigning it to a practical.");
  const last = await prisma.practicalSession.aggregate({ where: { offeringId: body.offeringId }, _max: { sequence: true } });
  const s = await prisma.practicalSession.create({ data: { ...body, marksReleaseAt: body.marksReleaseAt ?? null, sequence: (last._max.sequence ?? 0) + 1, conductedById: user.id } });
  await audit({ actorId: user.id, action: "SESSION_CREATE", entityType: "PracticalSession", entityId: s.id, after: body });
  await notifyOffering(body.offeringId, { type: "SESSION_UPCOMING", title: `New practical scheduled: ${offering.subject.shortName} #${s.sequence}`, body: `${exp.title} on ${body.scheduledStart.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`, link: `/practicals/${s.id}` });
  return s;
});
