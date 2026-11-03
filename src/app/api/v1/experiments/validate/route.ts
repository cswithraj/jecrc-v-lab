import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { LanguageEnum } from "@/lib/schemas";
import { TestCaseSchema } from "@/lib/services/experiments";
import { validateReference } from "@/lib/services/code";

const Body = z.object({ language: LanguageEnum, code: z.string().min(1).max(65536), timeLimitMs: z.number().int().min(100).max(10000).default(2000), memoryLimitKb: z.number().int().min(16384).max(524288).default(131072), tests: z.array(TestCaseSchema).max(50) });

/** POST /api/v1/experiments/validate — staff check that a reference solution passes the test cases (nothing is stored). */
export const POST = route({ permission: "experiments.manage" }, async (req, { user }) => validateReference(user, await parseBody(req, Body)));
