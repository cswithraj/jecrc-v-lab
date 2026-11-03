import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export async function audit(entry: { actorId: string | null; action: string; entityType: string; entityId?: string | null; before?: unknown; after?: unknown; reason?: string | null; ip?: string | null }, tx: Prisma.TransactionClient = prisma) {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId, action: entry.action, entityType: entry.entityType, entityId: entry.entityId ?? null,
      before: entry.before === undefined ? undefined : (JSON.parse(JSON.stringify(entry.before)) as Prisma.InputJsonValue),
      after: entry.after === undefined ? undefined : (JSON.parse(JSON.stringify(entry.after)) as Prisma.InputJsonValue),
      reason: entry.reason ?? null, ipAddress: entry.ip ?? null,
    },
  });
}
