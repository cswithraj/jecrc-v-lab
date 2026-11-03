import { NextResponse } from "next/server";
import { z } from "zod";
import { login, HOME_FOR_ROLE } from "@/lib/auth";
import { errorResponse, rateLimit, clientIp } from "@/lib/api";
import { audit } from "@/lib/audit";

const Body = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  try {
    rateLimit(`login:${clientIp(req) ?? "unknown"}`, 20, 60_000);
    const body = Body.parse(await req.json().catch(() => ({})));
    const result = await login(body.email, body.password);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });
    await audit({ actorId: result.user.id, action: "LOGIN", entityType: "User", entityId: result.user.id, ip: clientIp(req) });
    return NextResponse.json({ ok: true, redirect: HOME_FOR_ROLE[result.user.role] });
  } catch (e) {
    return errorResponse(e);
  }
}
