import { prisma } from "./db";

export type NotificationType = "SESSION_UPCOMING" | "ASSIGNMENT" | "DEADLINE" | "MARKS_RELEASED" | "MISSED_SESSION" | "PROJECT_DEADLINE" | "ANNOUNCEMENT" | "RESULT_PUBLISHED";

export async function notify(userIds: string[], n: { type: NotificationType; title: string; body: string; link?: string }) {
  if (!userIds.length) return;
  await prisma.notification.createMany({ data: [...new Set(userIds)].map((userId) => ({ userId, ...n })) });
}

export async function notifyOffering(offeringId: string, n: { type: NotificationType; title: string; body: string; link?: string }) {
  const rows = await prisma.studentEnrollment.findMany({ where: { offeringId, status: "ACTIVE" }, select: { studentId: true } });
  await notify(rows.map((r) => r.studentId), n);
}
