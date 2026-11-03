import { z } from "zod";
import { cookies } from "next/headers";
import { route, parseBody, ApiError, rateLimit } from "@/lib/api";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword, passwordProblems, SESSION_COOKIE, hashToken } from "@/lib/auth";
import { audit } from "@/lib/audit";

const Body = z.object({ current: z.string().min(1).max(200), next: z.string().min(1).max(200) });

/** POST /api/v1/auth/password — change own password; signs out every other session. */
export const POST = route({}, async (req, { user }) => {
  rateLimit(`pw:${user.id}`, 5, 15 * 60_000);
  if (user.isDemo) throw new ApiError(403, "Demo accounts are shared, so their password cannot be changed.");
  const { current, next } = await parseBody(req, Body);
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(current, row.passwordHash))) throw new ApiError(400, "Your current password is incorrect.");
  const problem = passwordProblems(next);
  if (problem) throw new ApiError(400, problem);
  if (current === next) throw new ApiError(400, "Choose a password different from the current one.");
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } }),
    prisma.authSession.deleteMany({ where: { userId: user.id, ...(token ? { id: { not: hashToken(token) } } : {}) } }),
  ]);
  await audit({ actorId: user.id, action: "auth.password_change", entityType: "User", entityId: user.id });
  return { ok: true };
});
