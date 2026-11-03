import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { runPublicTests } from "@/lib/services/code";
import { LanguageEnum } from "@/lib/schemas";

const Body = z.object({ language: LanguageEnum, code: z.string().max(65536), experimentId: z.string() });

/** POST /api/v1/test — run code against the experiment's public sample tests. */
export const POST = route({ permission: "code.run" }, async (req, { user }) => runPublicTests(user, await parseBody(req, Body)));
