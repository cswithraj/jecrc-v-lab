import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { prisma } from "@/lib/db";
import { saveDraft } from "@/lib/services/code";
import { LanguageEnum } from "@/lib/schemas";

const Body = z.object({ language: LanguageEnum, code: z.string().max(65536), experimentId: z.string() });

/** PUT /api/v1/drafts — autosave the current student's code. GET ?experimentId= — load drafts. */
export const PUT = route({ roles: ["STUDENT"] }, async (req, { user }) => saveDraft(user, await parseBody(req, Body)));
export const GET = route({ roles: ["STUDENT"] }, async (req, { user }) => {
  const experimentId = new URL(req.url).searchParams.get("experimentId") ?? "";
  return { drafts: await prisma.codeDraft.findMany({ where: { studentId: user.id, experimentId }, select: { language: true, code: true, updatedAt: true } }) };
});
