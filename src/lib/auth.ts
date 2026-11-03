import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Role, User } from "@prisma/client";
import { prisma } from "./db";

export const SESSION_COOKIE = "vlab_session";
const TTL_MS = Number(process.env.SESSION_TTL_HOURS || 12) * 3600_000;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function hashPassword(pw: string) { return bcrypt.hash(pw, 12); }
export async function verifyPassword(pw: string, hash: string) { return bcrypt.compare(pw, hash); }

export function passwordProblems(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Password must contain letters and numbers.";
  return null;
}

export type SessionUser = Pick<User, "id" | "email" | "name" | "role" | "departmentId" | "batchId" | "enrollmentNo" | "employeeId" | "isDemo" | "extraTimeMinutes">;

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  await prisma.authSession.create({
    data: { id: hashToken(token), userId, expiresAt: new Date(Date.now() + TTL_MS), ipAddress: h.get("x-forwarded-for")?.split(",")[0] ?? null, userAgent: h.get("user-agent")?.slice(0, 250) ?? null },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/", secure: process.env.COOKIE_SECURE === "true", maxAge: TTL_MS / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.authSession.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Current user or null. Sliding expiry: refreshed when less than half the TTL remains. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.authSession.findUnique({
    where: { id: hashToken(token) },
    include: { user: { select: { id: true, email: true, name: true, role: true, departmentId: true, batchId: true, enrollmentNo: true, employeeId: true, isDemo: true, extraTimeMinutes: true, isActive: true } } },
  });
  if (!s || s.expiresAt < new Date() || !s.user.isActive) return null;
  if (s.expiresAt.getTime() - Date.now() < TTL_MS / 2) {
    await prisma.authSession.update({ where: { id: s.id }, data: { expiresAt: new Date(Date.now() + TTL_MS), lastSeenAt: new Date() } }).catch(() => {});
  }
  const { isActive: _a, ...user } = s.user;
  return user;
}

export async function login(email: string, password: string): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  const generic = "Invalid email or password.";
  if (!user || !user.isActive) { await bcrypt.compare(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv"); return { ok: false, error: generic }; }
  if (user.lockedUntil && user.lockedUntil > new Date()) return { ok: false, error: "Account temporarily locked after repeated failed attempts. Try again later." };
  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedLogins + 1;
    await prisma.user.update({ where: { id: user.id }, data: { failedLogins: failed >= MAX_FAILED ? 0 : failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null } });
    return { ok: false, error: generic };
  }
  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await createSession(user.id);
  return { ok: true, user };
}

export const HOME_FOR_ROLE: Record<Role, string> = {
  SUPER_ADMIN: "/admin",
  HOD: "/admin",
  FACULTY: "/faculty",
  STUDENT: "/student",
};

/** For server components/pages: redirect to login if unauthenticated or lacking role. */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (roles && !roles.includes(u.role)) redirect(HOME_FOR_ROLE[u.role]);
  return u;
}
