// Create (or reset) a super administrator without demo data.
// Usage: ADMIN_EMAIL=you@uni.edu ADMIN_PASSWORD='Strong-pass-123' [ADMIN_NAME='Name'] npx tsx scripts/create-admin.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (10+ characters with letters and numbers).");
  }
  const dept = await prisma.department.upsert({ where: { code: "CA" }, update: {}, create: { code: "CA", name: "Department of Computer Applications" } });
  const passwordHash = await bcrypt.hash(password, 12);
  const u = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "SUPER_ADMIN", isActive: true, failedLogins: 0, lockedUntil: null },
    create: { email, name: process.env.ADMIN_NAME || "Platform Administrator", role: "SUPER_ADMIN", departmentId: dept.id, passwordHash },
  });
  await prisma.auditLog.create({ data: { action: "user.bootstrap_admin", entityType: "User", entityId: u.id, reason: "create-admin script" } });
  console.log(`Super administrator ready: ${email}`);
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
