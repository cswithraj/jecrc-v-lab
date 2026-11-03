import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { ApiError, forbidden, notFound, badRequest } from "@/lib/api";
import { canManageOffering } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { saveUpload } from "@/lib/storage";

export const PROJECT_RUBRIC_LABELS: Record<string, string> = {
  understanding: "Problem understanding", design: "Design (ER/class/flow diagrams)", implementation: "Implementation",
  testing: "Testing", documentation: "Documentation / report", viva: "Presentation & viva",
};

export const teamInclude = {
  project: { include: { milestones: { orderBy: { order: "asc" } } } },
  offering: { select: { id: true, resultsFinalized: true, subject: { select: { name: true, shortName: true } }, batch: { select: { code: true, name: true } } } },
  members: { include: { student: { select: { id: true, name: true, enrollmentNo: true } } }, orderBy: { isLeader: "desc" } },
  submissions: { orderBy: { createdAt: "desc" }, include: { milestone: { select: { title: true } } } },
} satisfies Prisma.ProjectTeamInclude;

/** Load a team the user may see: a member, or staff managing the class. Returns the access level. */
export async function loadTeam(user: SessionUser, teamId: string) {
  const team = await prisma.projectTeam.findUnique({ where: { id: teamId }, include: teamInclude });
  if (!team) throw notFound();
  const member = team.members.some((m) => m.studentId === user.id);
  const staff = user.role !== "STUDENT" && (await canManageOffering(user, team.offeringId));
  if (!member && !staff) throw notFound();
  return { team, member, staff };
}

export const CreateTeam = z.object({ offeringId: z.string(), projectId: z.string(), name: z.string().trim().min(1).max(80), studentIds: z.array(z.string()).min(1).max(10) });

export async function createTeam(user: SessionUser, input: z.infer<typeof CreateTeam>) {
  if (!(await canManageOffering(user, input.offeringId))) throw forbidden();
  const [offering, project] = await Promise.all([
    prisma.subjectOffering.findUniqueOrThrow({ where: { id: input.offeringId }, select: { subjectId: true } }),
    prisma.project.findUniqueOrThrow({ where: { id: input.projectId } }),
  ]);
  if (project.subjectId !== offering.subjectId) throw badRequest("This project belongs to a different laboratory.");
  const ids = [...new Set(input.studentIds)];
  if (ids.length > project.maxTeamSize) throw badRequest(`A team can have at most ${project.maxTeamSize} member(s).`);
  const enrolled = await prisma.studentEnrollment.count({ where: { offeringId: input.offeringId, studentId: { in: ids }, status: "ACTIVE" } });
  if (enrolled !== ids.length) throw badRequest("Every member must be enrolled in this class.");
  const taken = await prisma.projectTeamMember.findMany({ where: { studentId: { in: ids }, team: { projectId: project.id, offeringId: input.offeringId } }, include: { student: { select: { name: true } } } });
  if (taken.length) throw new ApiError(409, `Already in a team: ${taken.map((t) => t.student.name).join(", ")}.`);
  const team = await prisma.projectTeam.create({ data: { projectId: project.id, offeringId: input.offeringId, name: input.name, members: { create: ids.map((studentId, i) => ({ studentId, isLeader: i === 0 })) } } });
  await audit({ actorId: user.id, action: "project.team_create", entityType: "ProjectTeam", entityId: team.id, after: { name: input.name, members: ids } });
  await notify(ids, { type: "ASSIGNMENT", title: `Project assigned: ${project.title}`, body: `You are in ${input.name}.`, link: `/projects/teams/${team.id}` });
  return team;
}

/** Students start an individual project themselves (solo team). Group teams are formed by faculty. */
export async function startSoloProject(user: SessionUser, offeringId: string, projectId: string) {
  if (user.role !== "STUDENT") throw forbidden();
  const [enr, project] = await Promise.all([
    prisma.studentEnrollment.findUnique({ where: { offeringId_studentId: { offeringId, studentId: user.id } }, include: { offering: { select: { subjectId: true } } } }),
    prisma.project.findUnique({ where: { id: projectId } }),
  ]);
  if (!enr || !project || project.subjectId !== enr.offering.subjectId || !project.isActive) throw notFound();
  if (project.isGroup) throw badRequest("This is a group project; your faculty will form the teams.");
  const existing = await prisma.projectTeam.findFirst({ where: { projectId, offeringId, members: { some: { studentId: user.id } } } });
  if (existing) return existing;
  return prisma.projectTeam.create({ data: { projectId, offeringId, name: user.name, members: { create: [{ studentId: user.id, isLeader: true }] } } });
}

export async function deleteTeam(user: SessionUser, teamId: string) {
  const { team, staff } = await loadTeam(user, teamId);
  if (!staff) throw forbidden();
  if (team.status === "EVALUATED") throw new ApiError(409, "Evaluated teams cannot be deleted.");
  await prisma.projectTeam.delete({ where: { id: teamId } });
  await audit({ actorId: user.id, action: "project.team_delete", entityType: "ProjectTeam", entityId: teamId, before: { name: team.name, members: team.members.map((m) => m.studentId) } });
}

export const SubmissionInput = z.object({
  kind: z.enum(["REPO", "DOCUMENT", "DEMO", "NOTE"]),
  url: z.string().trim().url().max(500).refine((u) => /^https?:\/\//i.test(u), "Links must start with http:// or https://").optional(),
  notes: z.string().trim().max(4000).optional(),
  milestoneId: z.string().optional(),
});

export async function addSubmission(user: SessionUser, teamId: string, input: z.infer<typeof SubmissionInput>, file?: File | null) {
  const { team, member } = await loadTeam(user, teamId);
  if (!member) throw forbidden("Only team members can submit.");
  if (team.status === "EVALUATED") throw new ApiError(409, "This project has been evaluated; submissions are closed.");
  if (input.milestoneId && !team.project.milestones.some((m) => m.id === input.milestoneId)) throw badRequest("Unknown milestone.");
  if (!input.url && !file && !input.notes) throw badRequest("Add a link, a file or a note.");
  const stored = file && file.size > 0 ? await saveUpload(file, `projects/${teamId}`) : null;
  const sub = await prisma.projectSubmission.create({ data: { teamId, kind: input.kind, url: input.url ?? null, notes: input.notes ?? null, milestoneId: input.milestoneId ?? null, fileKey: stored?.key ?? null, fileName: stored?.name ?? null, submittedById: user.id } });
  if (team.status === "IN_PROGRESS") await prisma.projectTeam.update({ where: { id: teamId }, data: { status: "SUBMITTED" } });
  return sub;
}

export async function evaluateTeam(user: SessionUser, teamId: string, evaluation: Record<string, number>, feedback?: string) {
  const { team, staff } = await loadTeam(user, teamId);
  if (!staff) throw forbidden();
  if (team.offering.resultsFinalized) throw new ApiError(409, "Results for this class are finalized; project marks are locked.");
  const rubric = team.project.rubric as Record<string, number>;
  const clean: Record<string, number> = {};
  for (const [k, max] of Object.entries(rubric)) {
    const v = evaluation[k];
    if (typeof v !== "number" || Number.isNaN(v) || v < 0 || v > max) throw badRequest(`${PROJECT_RUBRIC_LABELS[k] ?? k} must be between 0 and ${max}.`);
    clean[k] = Math.round(v * 100) / 100;
  }
  const weightTotal = Object.values(rubric).reduce((a, b) => a + b, 0) || 1;
  const marks = Math.round((Object.values(clean).reduce((a, b) => a + b, 0) / weightTotal) * team.project.maxMarks * 100) / 100;
  const vivaMarks = rubric.viva ? Math.round((clean.viva / rubric.viva) * 10000) / 100 : null;
  const updated = await prisma.$transaction(async (tx) => {
    const t = await tx.projectTeam.update({ where: { id: teamId }, data: { evaluation: { ...clean, ...(feedback ? { feedback } : {}) }, marks, vivaMarks, status: "EVALUATED", evaluatedById: user.id, evaluatedAt: new Date() } });
    await audit({ actorId: user.id, action: "project.evaluate", entityType: "ProjectTeam", entityId: teamId, before: { evaluation: team.evaluation, marks: team.marks }, after: { evaluation: clean, marks }, reason: feedback ?? null }, tx);
    return t;
  });
  await notify(team.members.map((m) => m.studentId), { type: "MARKS_RELEASED", title: `Project evaluated: ${team.project.title}`, body: `${team.name} scored ${marks}/${team.project.maxMarks}.${feedback ? ` Feedback: ${feedback.slice(0, 300)}` : ""}`, link: `/projects/teams/${teamId}` });
  return updated;
}
