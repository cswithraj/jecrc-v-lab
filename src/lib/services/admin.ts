import "server-only";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { hashPassword, passwordProblems } from "@/lib/auth";
import { ApiError, forbidden, badRequest, notFound } from "@/lib/api";
import { audit } from "@/lib/audit";
import { parseCsv } from "@/lib/csv";
import { DEFAULT_POLICY } from "@/lib/grading";
import { LanguageEnum, EnvironmentEnum } from "@/lib/schemas";

const opt = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((x) => x ?? null);
export const tempPassword = () => `Vlab-${randomBytes(6).toString("base64url")}9`;

// ───────────────────────── Users ─────────────────────────

const RoleEnum = z.enum(["SUPER_ADMIN", "HOD", "FACULTY", "STUDENT"]);
export const UserCreate = z.object({
  name: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email().max(200), role: RoleEnum,
  password: opt(z.string().max(200)), enrollmentNo: opt(z.string().trim().max(40)), employeeId: opt(z.string().trim().max(40)),
  departmentId: opt(z.string()), batchId: opt(z.string()), phone: opt(z.string().trim().max(20)),
});
export const UserUpdate = z.object({
  name: z.string().trim().min(2).max(120).optional(), role: RoleEnum.optional(), isActive: z.boolean().optional(),
  enrollmentNo: opt(z.string().trim().max(40)).optional(), employeeId: opt(z.string().trim().max(40)).optional(),
  departmentId: opt(z.string()).optional(), batchId: opt(z.string()).optional(), extraTimeMinutes: z.number().int().min(0).max(240).nullish().transform((x) => x ?? 0).optional(),
});

/** HODs manage faculty and students of their own department only; only super admins manage admins/HODs. */
function assertCanManage(actor: SessionUser, target: { role: Role; departmentId: string | null }, newRole?: Role) {
  if (actor.role === "SUPER_ADMIN") return;
  if (actor.role !== "HOD") throw forbidden();
  const roles: Role[] = ["FACULTY", "STUDENT"];
  if (!roles.includes(target.role) || (newRole && !roles.includes(newRole))) throw forbidden("Only a super administrator can manage administrator and HOD accounts.");
  if (target.departmentId !== actor.departmentId) throw forbidden("You can only manage users in your own department.");
}

export async function createUser(actor: SessionUser, input: z.infer<typeof UserCreate>) {
  const departmentId = actor.role === "HOD" ? actor.departmentId : input.departmentId;
  assertCanManage(actor, { role: input.role, departmentId });
  let password = input.password ?? null;
  const generated = !password;
  if (!password) password = tempPassword();
  const problem = passwordProblems(password);
  if (problem) throw badRequest(problem);
  if (input.role === "STUDENT" && !input.enrollmentNo) throw badRequest("Students need an enrollment number.");
  const u = await prisma.user.create({ data: { name: input.name, email: input.email, role: input.role, passwordHash: await hashPassword(password), enrollmentNo: input.role === "STUDENT" ? input.enrollmentNo : null, employeeId: input.role === "STUDENT" ? null : input.employeeId, departmentId, batchId: input.role === "STUDENT" ? input.batchId : null, phone: input.phone } });
  await audit({ actorId: actor.id, action: "user.create", entityType: "User", entityId: u.id, after: { email: u.email, role: u.role } });
  return { id: u.id, email: u.email, tempPassword: generated ? password : null, message: generated ? `Account created for ${u.email}. Temporary password (shown once): ${password}` : `Account created for ${u.email}.` };
}

export async function updateUser(actor: SessionUser, id: string, input: z.infer<typeof UserUpdate>) {
  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) throw notFound();
  assertCanManage(actor, before, input.role);
  if (id === actor.id && (input.role || input.isActive === false)) throw badRequest("You cannot change your own role or deactivate yourself.");
  const data: Prisma.UserUpdateInput = {};
  for (const k of ["name", "role", "isActive", "enrollmentNo", "employeeId", "extraTimeMinutes"] as const) if (input[k] !== undefined) (data as Record<string, unknown>)[k] = input[k];
  if (input.departmentId !== undefined && actor.role === "SUPER_ADMIN") data.department = input.departmentId ? { connect: { id: input.departmentId } } : { disconnect: true };
  if (input.batchId !== undefined) data.batch = input.batchId ? { connect: { id: input.batchId } } : { disconnect: true };
  const u = await prisma.user.update({ where: { id }, data });
  if (input.isActive === false) await prisma.authSession.deleteMany({ where: { userId: id } });
  await audit({ actorId: actor.id, action: "user.update", entityType: "User", entityId: id, before: pick(before, Object.keys(input)), after: pick(u, Object.keys(input)) });
  return { ok: true };
}

export async function resetPassword(actor: SessionUser, id: string) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw notFound();
  assertCanManage(actor, target);
  const password = tempPassword();
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null } }),
    prisma.authSession.deleteMany({ where: { userId: id } }),
  ]);
  await audit({ actorId: actor.id, action: "user.password_reset", entityType: "User", entityId: id });
  return { tempPassword: password };
}

/** CSV columns: name,email,role,enrollment_no,employee_id,batch_code. New users get temporary passwords (returned once). */
export async function importUsers(actor: SessionUser, text: string) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw badRequest("The file has no data rows.");
  const h = rows[0].map((x) => x.trim().toLowerCase());
  const col = (r: string[], k: string) => (h.indexOf(k) >= 0 ? (r[h.indexOf(k)] ?? "").trim() : "");
  for (const k of ["name", "email", "role"]) if (!h.includes(k)) throw badRequest(`Missing column "${k}".`);
  const batches = new Map((await prisma.batch.findMany({ select: { id: true, code: true } })).map((b) => [b.code, b.id]));
  const created: { email: string; tempPassword: string }[] = []; const errors: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.every((c) => !c.trim())) continue;
    try {
      const bc = col(r, "batch_code");
      if (bc && !batches.has(bc)) throw new Error(`unknown batch ${bc}`);
      const res = await createUser(actor, UserCreate.parse({ name: col(r, "name"), email: col(r, "email"), role: col(r, "role").toUpperCase(), enrollmentNo: col(r, "enrollment_no") || null, employeeId: col(r, "employee_id") || null, batchId: bc ? batches.get(bc) : null, departmentId: actor.departmentId }));
      created.push({ email: res.email, tempPassword: res.tempPassword! });
    } catch (e) {
      const m = e instanceof z.ZodError ? e.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") : (e as { code?: string }).code === "P2002" ? "email or ID already exists" : (e as Error).message;
      errors.push(`Row ${i + 1}: ${m}`);
    }
  }
  return { created, errors };
}

function pick(o: object, keys: string[]) { return Object.fromEntries(keys.map((k) => [k, (o as Record<string, unknown>)[k]])); }

// ───────────────────────── Academic structure ─────────────────────────

export const Schemas = {
  departments: z.object({ code: z.string().trim().toUpperCase().min(2).max(20), name: z.string().trim().min(3).max(120) }),
  courses: z.object({ code: z.string().trim().toUpperCase().min(2).max(30), name: z.string().trim().min(3).max(120), durationSem: z.number().int().min(1).max(12), departmentId: z.string() }),
  sessions: z.object({ name: z.string().trim().min(3).max(60), startDate: z.coerce.date(), endDate: z.coerce.date(), isCurrent: z.boolean().default(false) }),
  batches: z.object({ code: z.string().trim().toUpperCase().min(2).max(30), name: z.string().trim().min(3).max(120), courseId: z.string(), semesterNumber: z.number().int().min(1).max(12).nullish(), academicSessionId: z.string() }),
};

export async function createAcademic(actor: SessionUser, kind: keyof typeof Schemas, body: unknown) {
  if (kind === "departments" && actor.role !== "SUPER_ADMIN") throw forbidden("Only a super administrator can add departments.");
  let created: { id: string };
  switch (kind) {
    case "departments": created = await prisma.department.create({ data: Schemas.departments.parse(body) }); break;
    case "courses": {
      const c = Schemas.courses.parse(body);
      if (actor.role === "HOD" && c.departmentId !== actor.departmentId) throw forbidden();
      created = await prisma.course.create({ data: { ...c, semesters: { create: Array.from({ length: c.durationSem }, (_, i) => ({ number: i + 1 })) } } });
      break;
    }
    case "sessions": {
      const s = Schemas.sessions.parse(body);
      if (s.endDate <= s.startDate) throw badRequest("End date must be after start date.");
      created = await prisma.$transaction(async (tx) => { if (s.isCurrent) await tx.academicSession.updateMany({ data: { isCurrent: false } }); return tx.academicSession.create({ data: s }); });
      break;
    }
    case "batches": {
      const b = Schemas.batches.parse(body);
      const sem = b.semesterNumber ? await prisma.semester.findUnique({ where: { courseId_number: { courseId: b.courseId, number: b.semesterNumber } } }) : null;
      created = await prisma.batch.create({ data: { code: b.code, name: b.name, courseId: b.courseId, academicSessionId: b.academicSessionId, semesterId: sem?.id ?? null } });
      break;
    }
  }
  await audit({ actorId: actor.id, action: `academics.${kind}.create`, entityType: kind, entityId: created.id, after: body });
  return created;
}

export async function setCurrentSession(actor: SessionUser, id: string) {
  await prisma.$transaction([prisma.academicSession.updateMany({ data: { isCurrent: false } }), prisma.academicSession.update({ where: { id }, data: { isCurrent: true } })]);
  await audit({ actorId: actor.id, action: "academics.session.current", entityType: "AcademicSession", entityId: id });
}

// ───────────────────────── Subjects & classes ─────────────────────────

export const SubjectCreate = z.object({
  code: z.string().trim().toUpperCase().min(3).max(30), name: z.string().trim().min(3).max(120), shortName: z.string().trim().min(2).max(40),
  description: z.string().trim().max(2000).default(""), departmentId: z.string(), credits: z.number().int().min(1).max(4),
  defaultLanguage: LanguageEnum, defaultEnvironment: EnvironmentEnum.default("CODE"), color: z.string().regex(/^#[0-9a-f]{6}$/i).default("#C00010"), icon: z.string().max(40).default("code"),
});
export const SubjectUpdate = z.object({
  name: z.string().trim().min(3).max(120).optional(), credits: z.number().int().min(1).max(4).optional(), requiredExperiments: z.number().int().min(1).max(120).nullish(),
  hoursPerWeek: z.number().int().min(1).max(12).optional(), sessionMinutes: z.number().int().min(30).max(360).optional(),
  easyTarget: z.number().int().min(0).max(200).optional(), mediumTarget: z.number().int().min(0).max(200).optional(), hardTarget: z.number().int().min(0).max(200).optional(), isActive: z.boolean().optional(),
});

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export async function createSubject(actor: SessionUser, input: z.infer<typeof SubjectCreate>) {
  if (actor.role === "HOD" && input.departmentId !== actor.departmentId) throw forbidden();
  const s = await prisma.subject.create({ data: { ...input, slug: slugify(input.name), languages: [input.defaultLanguage], requiredExperiments: input.credits * 15, sessionMinutes: 120, hoursPerWeek: 4 } });
  await audit({ actorId: actor.id, action: "subject.create", entityType: "Subject", entityId: s.id, after: input });
  return s;
}

/** Credit rule: 1 credit = 15 practicals. Changing credits resets the requirement unless an explicit override is given. */
export async function updateSubject(actor: SessionUser, id: string, input: z.infer<typeof SubjectUpdate>) {
  const before = await prisma.subject.findUnique({ where: { id } });
  if (!before) throw notFound();
  if (actor.role === "HOD" && before.departmentId !== actor.departmentId) throw forbidden();
  const data: Prisma.SubjectUpdateInput = { ...input, requiredExperiments: undefined };
  if (input.requiredExperiments != null) data.requiredExperiments = input.requiredExperiments;
  else if (input.credits && input.credits !== before.credits) data.requiredExperiments = input.credits * 15;
  const s = await prisma.subject.update({ where: { id }, data });
  await audit({ actorId: actor.id, action: "subject.update", entityType: "Subject", entityId: id, before: pick(before, Object.keys(input)), after: pick(s, Object.keys(input)) });
  return s;
}

export async function setSubjectFaculty(actor: SessionUser, subjectId: string, userIds: string[]) {
  const s = await prisma.subject.findUniqueOrThrow({ where: { id: subjectId } });
  if (actor.role === "HOD" && s.departmentId !== actor.departmentId) throw forbidden();
  const staff = await prisma.user.count({ where: { id: { in: userIds }, role: { in: ["FACULTY", "HOD"] } } });
  if (staff !== userIds.length) throw badRequest("Only faculty or HOD accounts can be assigned.");
  await prisma.$transaction([prisma.subjectFaculty.deleteMany({ where: { subjectId } }), prisma.subjectFaculty.createMany({ data: userIds.map((userId, i) => ({ subjectId, userId, isCoordinator: i === 0 })) })]);
  await audit({ actorId: actor.id, action: "subject.faculty", entityType: "Subject", entityId: subjectId, after: { userIds } });
}

export const OfferingCreate = z.object({ subjectId: z.string(), batchId: z.string(), academicSessionId: z.string(), facultyId: opt(z.string()), requiredExperiments: z.number().int().min(1).max(120).nullish(), enrollBatch: z.boolean().default(true) });

export async function createOffering(actor: SessionUser, input: z.infer<typeof OfferingCreate>) {
  const s = await prisma.subject.findUniqueOrThrow({ where: { id: input.subjectId } });
  if (actor.role === "HOD" && s.departmentId !== actor.departmentId) throw forbidden();
  const o = await prisma.subjectOffering.create({ data: { subjectId: input.subjectId, batchId: input.batchId, academicSessionId: input.academicSessionId, facultyId: input.facultyId, requiredExperiments: input.requiredExperiments ?? null } });
  let enrolled = 0;
  if (input.enrollBatch) enrolled = (await enrollBatch(o.id, input.batchId)).count;
  await audit({ actorId: actor.id, action: "offering.create", entityType: "SubjectOffering", entityId: o.id, after: { ...input, enrolled } });
  return { id: o.id, enrolled };
}

export async function enrollBatch(offeringId: string, batchId: string) {
  const students = await prisma.user.findMany({ where: { batchId, role: "STUDENT", isActive: true }, select: { id: true } });
  return prisma.studentEnrollment.createMany({ data: students.map((s) => ({ offeringId, studentId: s.id })), skipDuplicates: true });
}

// ───────────────────────── Grading policy ─────────────────────────

export const PolicyInput = z.object({
  name: z.string().trim().min(3).max(80),
  weights: z.object({ experiments: z.number().min(0).max(100), project: z.number().min(0).max(100), viva: z.number().min(0).max(100), attendance: z.number().min(0).max(100) }).refine((w) => Math.abs(w.experiments + w.project + w.viva + w.attendance - 100) < 1e-6, "Weights must add up to 100."),
  bands: z.array(z.object({ grade: z.string().trim().min(1).max(4), min: z.number().min(0).max(100), points: z.number().min(0).max(10) })).min(2).max(12)
    .refine((b) => b.some((x) => x.min === 0), "One grade band must start at 0.").refine((b) => new Set(b.map((x) => x.min)).size === b.length, "Band thresholds must be distinct."),
  passPercent: z.number().min(0).max(100), minAttendancePercent: z.number().min(0).max(100),
  tieBreak: z.array(z.enum(["weightedScore", "experimentAvg", "projectMarks", "vivaMarks", "attendancePercent"])).min(1).max(5),
});

export async function saveDefaultPolicy(actor: SessionUser, input: z.infer<typeof PolicyInput>) {
  const before = await prisma.gradingPolicy.findFirst({ where: { isDefault: true } });
  const data = { name: input.name, weights: input.weights, bands: [...input.bands].sort((a, b) => b.min - a.min), passPercent: input.passPercent, minAttendancePercent: input.minAttendancePercent, tieBreak: input.tieBreak, isDefault: true };
  const p = before ? await prisma.gradingPolicy.update({ where: { id: before.id }, data }) : await prisma.gradingPolicy.create({ data });
  await audit({ actorId: actor.id, action: "grading.policy", entityType: "GradingPolicy", entityId: p.id, before: before ?? DEFAULT_POLICY, after: data, reason: "Applies to results computed from now on; finalized results are unchanged." });
  return p;
}

// ───────────────────────── Settings ─────────────────────────

const urlOrPath = z.string().trim().max(500).refine((s) => s === "" || s.startsWith("/") || /^https:\/\//.test(s), "Use a site path (/brand/logo.png) or an https URL.").transform((s) => s || null);
export const InstitutionInput = z.object({
  platformName: z.string().trim().min(3).max(120), shortName: z.string().trim().min(2).max(40), tagline: z.string().trim().max(200), university: z.string().trim().min(3).max(120),
  city: z.string().trim().max(120), department: z.string().trim().max(120), academicYear: z.string().trim().max(20), motto: z.string().trim().max(120),
  logoUrl: urlOrPath.nullable(), logoDarkUrl: urlOrPath.nullable(), crestUrl: urlOrPath.nullable(), primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i, "Use a hex colour like #E30613"),
  supportEmail: z.string().trim().email().max(200), supportPhone: z.string().trim().max(30), projectOwner: z.string().trim().max(120), projectOwnerTitle: z.string().trim().max(200),
});
export const ExamRulesInput = z.object({ defaultSessionMinutes: z.number().int().min(30).max(360), autosaveSeconds: z.number().int().min(5).max(120), allowLateByDefault: z.boolean(), maxRunsPerMinute: z.number().int().min(5).max(120) });

export async function saveSetting(actor: SessionUser, key: "institution" | "examRules", value: object) {
  if (actor.role !== "SUPER_ADMIN") throw forbidden();
  const before = await prisma.setting.findUnique({ where: { key } });
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  await audit({ actorId: actor.id, action: `settings.${key}`, entityType: "Setting", entityId: key, before: before?.value, after: value });
  return { ok: true };
}

export function assertAdmin(u: SessionUser) { if (u.role !== "SUPER_ADMIN" && u.role !== "HOD") throw new ApiError(403, "Administrators only."); }
