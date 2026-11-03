import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { runCustom } from "@/lib/services/code";
import { LanguageEnum } from "@/lib/schemas";

const Body = z.object({ language: LanguageEnum, code: z.string().max(65536), stdin: z.string().max(1_000_000).default(""), experimentId: z.string().optional() });

/** POST /api/v1/run — compile & run code with custom input in the sandbox. */
export const POST = route({ permission: "code.run" }, async (req, { user }) => runCustom(user, await parseBody(req, Body)));
