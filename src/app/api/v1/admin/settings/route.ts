import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { InstitutionInput, ExamRulesInput, saveSetting } from "@/lib/services/admin";

const Body = z.union([z.object({ key: z.literal("institution"), value: InstitutionInput }), z.object({ key: z.literal("examRules"), value: ExamRulesInput })]);
/** PUT /api/v1/admin/settings { key: "institution" | "examRules", value } — super admin only. */
export const PUT = route({ permission: "settings.manage" }, async (req, { user }) => { const b = await parseBody(req, Body); return saveSetting(user, b.key, b.value); });
