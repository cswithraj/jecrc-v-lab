import { route, parseBody } from "@/lib/api";
import { PolicyInput, saveDefaultPolicy } from "@/lib/services/admin";

/** PUT /api/v1/admin/grading — update the default grading policy (applies to results computed afterwards). */
export const PUT = route({ permission: "grading.manage" }, async (req, { user }) => saveDefaultPolicy(user, await parseBody(req, PolicyInput)));
