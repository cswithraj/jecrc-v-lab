import type { Role } from "@prisma/client";
import { prisma } from "./db";
import type { SessionUser } from "./auth";

/** Coarse permission matrix. Fine-grained ownership checks are in the helpers below. */
export const PERMISSIONS = {
  "users.manage": ["SUPER_ADMIN", "HOD"],
  "academics.manage": ["SUPER_ADMIN", "HOD"], // departments, courses, batches, sessions
  "settings.manage": ["SUPER_ADMIN"],
  "grading.manage": ["SUPER_ADMIN", "HOD"],
  "audit.view": ["SUPER_ADMIN", "HOD"],
  "subjects.manage": ["SUPER_ADMIN", "HOD", "FACULTY"],
  "experiments.manage": ["SUPER_ADMIN", "HOD", "FACULTY"],
  "sessions.manage": ["SUPER_ADMIN", "HOD", "FACULTY"],
  "marks.manage": ["SUPER_ADMIN", "HOD", "FACULTY"],
  "results.finalize": ["SUPER_ADMIN", "HOD", "FACULTY"],
  "reports.view": ["SUPER_ADMIN", "HOD", "FACULTY"],
  "code.run": ["SUPER_ADMIN", "HOD", "FACULTY", "STUDENT"],
  "submissions.create": ["STUDENT"],
} satisfies Record<string, Role[]>;
export type Permission = keyof typeof PERMISSIONS;

export const can = (u: Pick<SessionUser, "role">, p: Permission) => (PERMISSIONS[p] as Role[]).includes(u.role);
export const isStaff = (u: Pick<SessionUser, "role">) => u.role !== "STUDENT";
export const isAdmin = (u: Pick<SessionUser, "role">) => u.role === "SUPER_ADMIN" || u.role === "HOD";

/** Can this staff member manage the given subject? Admins: all; HOD: own department; faculty: assigned subjects. */
export async function canManageSubject(u: SessionUser, subjectId: string) {
  if (u.role === "SUPER_ADMIN") return true;
  if (u.role === "STUDENT") return false;
  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { departmentId: true, faculty: { where: { userId: u.id }, select: { userId: true } }, offerings: { where: { facultyId: u.id }, select: { id: true } } } });
  if (!subject) return false;
  if (u.role === "HOD") return subject.departmentId === u.departmentId;
  return subject.faculty.length > 0 || subject.offerings.length > 0;
}

export async function canManageOffering(u: SessionUser, offeringId: string) {
  if (u.role === "SUPER_ADMIN") return true;
  if (u.role === "STUDENT") return false;
  const o = await prisma.subjectOffering.findUnique({ where: { id: offeringId }, select: { facultyId: true, subjectId: true, subject: { select: { departmentId: true } } } });
  if (!o) return false;
  if (u.role === "HOD") return o.subject.departmentId === u.departmentId;
  return o.facultyId === u.id || (await canManageSubject(u, o.subjectId));
}

/** Subject ids visible to the user (students: enrolled; faculty: assigned; HOD: department; admin: all). */
export async function visibleSubjectIds(u: SessionUser): Promise<string[] | "ALL"> {
  if (u.role === "SUPER_ADMIN") return "ALL";
  if (u.role === "HOD") return (await prisma.subject.findMany({ where: { departmentId: u.departmentId ?? "" }, select: { id: true } })).map((s) => s.id);
  if (u.role === "FACULTY") {
    const rows = await prisma.subject.findMany({ where: { OR: [{ faculty: { some: { userId: u.id } } }, { offerings: { some: { facultyId: u.id } } }] }, select: { id: true } });
    return rows.map((r) => r.id);
  }
  const rows = await prisma.studentEnrollment.findMany({ where: { studentId: u.id, status: "ACTIVE" }, select: { offering: { select: { subjectId: true } } } });
  return [...new Set(rows.map((r) => r.offering.subjectId))];
}
