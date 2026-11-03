import type { Prisma } from "@prisma/client";
import { route, parseBody, pageParams } from "@/lib/api";
import { prisma } from "@/lib/db";
import { UserCreate, createUser } from "@/lib/services/admin";

/** GET /api/v1/admin/users?role=&q=&page= — HODs see their department only. */
export const GET = route({ permission: "users.manage" }, async (req, { user }) => {
  const url = new URL(req.url); const sp = url.searchParams; const { skip, take, page, pageSize } = pageParams(url);
  const where: Prisma.UserWhereInput = {};
  if (user.role === "HOD") where.departmentId = user.departmentId;
  if (sp.get("role")) where.role = sp.get("role") as never;
  if (sp.get("q")) where.OR = ["name", "email", "enrollmentNo", "employeeId"].map((k) => ({ [k]: { contains: sp.get("q")!, mode: "insensitive" } }));
  const [items, total] = await Promise.all([prisma.user.findMany({ where, skip, take, orderBy: [{ role: "asc" }, { name: "asc" }], select: { id: true, name: true, email: true, role: true, enrollmentNo: true, employeeId: true, isActive: true, lastLoginAt: true, batch: { select: { code: true } } } }), prisma.user.count({ where })]);
  return { items, total, page, pageSize };
});
/** POST /api/v1/admin/users — create; returns a one-time temporary password when none was given. */
export const POST = route({ permission: "users.manage" }, async (req, { user }) => createUser(user, await parseBody(req, UserCreate)));
