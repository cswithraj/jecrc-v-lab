import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

/** Offerings (classes) the staff member manages. */
export async function managedOfferings(user: SessionUser) {
  const where =
    user.role === "SUPER_ADMIN" ? {} :
    user.role === "HOD" ? { subject: { departmentId: user.departmentId ?? "" } } :
    { OR: [{ facultyId: user.id }, { subject: { faculty: { some: { userId: user.id } } } }] };
  return prisma.subjectOffering.findMany({
    where, orderBy: [{ subject: { name: "asc" } }],
    include: { subject: { select: { id: true, name: true, shortName: true, slug: true, credits: true, requiredExperiments: true, color: true, icon: true } }, batch: { select: { name: true, code: true } }, academicSession: { select: { name: true } }, _count: { select: { enrollments: true, sessions: true } } },
  });
}
