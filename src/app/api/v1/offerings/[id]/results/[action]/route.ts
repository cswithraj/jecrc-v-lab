import { z } from "zod";
import { route, parseBody, notFound, forbidden, badRequest } from "@/lib/api";
import { canManageOffering } from "@/lib/rbac";
import { computeAndStore, finalizeResults, unlockResults } from "@/lib/services/results";
import { exportResults } from "@/lib/services/result-export";

type P = { id: string; action: string };
const Unlock = z.object({ reason: z.string().trim().min(5).max(500) });

/** POST /api/v1/offerings/:id/results/compute | finalize | unlock */
export const POST = route<P>({ permission: "results.finalize" }, async (req, { user, params }) => {
  switch (params.action) {
    case "compute": { const p = await computeAndStore(user, params.id); return { ok: true, students: p.rows.length, pendingManual: p.pendingManual }; }
    case "finalize": await finalizeResults(user, params.id); return { ok: true };
    case "unlock": await unlockResults(user, params.id, (await parseBody(req, Unlock)).reason); return { ok: true };
  }
  throw notFound("Unknown action.");
});

/** GET /api/v1/offerings/:id/results/export?format=csv|xlsx|pdf */
export const GET = route<P>({ permission: "results.finalize" }, async (req, { user, params }) => {
  if (params.action !== "export") throw notFound("Unknown action.");
  if (!(await canManageOffering(user, params.id))) throw forbidden();
  const f = new URL(req.url).searchParams.get("format") ?? "csv";
  if (!["csv", "xlsx", "pdf"].includes(f)) throw badRequest("format must be csv, xlsx or pdf.");
  const out = await exportResults(params.id, f as "csv" | "xlsx" | "pdf");
  return new Response(out.body as BodyInit, { headers: { "content-type": out.type, "content-disposition": `attachment; filename="${out.filename}"`, "cache-control": "no-store" } });
});
