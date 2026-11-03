import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import type { Role } from "@prisma/client";
import { getCurrentUser, type SessionUser } from "./auth";
import { can, type Permission } from "./rbac";
import { ExecutionUnavailableError } from "./execution/types";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}
export const forbidden = (msg = "You do not have permission to perform this action.") => new ApiError(403, msg);
export const notFound = (msg = "Not found.") => new ApiError(404, msg);
export const badRequest = (msg: string, details?: unknown) => new ApiError(400, msg, details);

type Ctx<P> = { params: Promise<P> };
type Handler<P> = (req: Request, ctx: { user: SessionUser; params: P }) => Promise<unknown>;

/**
 * Wrap a route handler: authentication, role/permission check, error → JSON mapping.
 * Every API route MUST go through this so authorization is never forgotten.
 */
export function route<P = Record<string, string>>(opts: { roles?: Role[]; permission?: Permission }, handler: Handler<P>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const user = await getCurrentUser();
      if (!user) throw new ApiError(401, "Please sign in.");
      if (opts.roles && !opts.roles.includes(user.role)) throw forbidden();
      if (opts.permission && !can(user, opts.permission)) throw forbidden();
      const params = (await ctx.params) ?? ({} as P);
      const result = await handler(req, { user, params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) return NextResponse.json({ error: e.message, details: e.details }, { status: e.status });
  if (e instanceof ZodError) return NextResponse.json({ error: "Validation failed", details: e.flatten() }, { status: 422 });
  if (e instanceof ExecutionUnavailableError) return NextResponse.json({ error: e.message }, { status: 503 });
  const code = (e as { code?: string })?.code;
  if (code === "P2002") return NextResponse.json({ error: "A record with these details already exists." }, { status: 409 });
  if (code === "P2025") return NextResponse.json({ error: "Record not found." }, { status: 404 });
  console.error("[api]", e);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try { json = await req.json(); } catch { throw badRequest("Request body must be JSON."); }
  return schema.parse(json);
}

export function pageParams(url: URL, maxSize = 100) {
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(maxSize, Math.max(1, Number(url.searchParams.get("pageSize") || 20)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

// Simple fixed-window in-memory limiter (per instance). Use Redis in multi-instance deployments.
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) { buckets.set(key, { count: 1, reset: now + windowMs }); return; }
  if (++b.count > limit) throw new ApiError(429, "Too many requests. Please slow down.");
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}
