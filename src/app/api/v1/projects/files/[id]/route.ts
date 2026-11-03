import { route, notFound } from "@/lib/api";
import { prisma } from "@/lib/db";
import { loadTeam } from "@/lib/services/projects";
import { readUpload } from "@/lib/storage";

/** GET /api/v1/projects/files/:submissionId — download an uploaded project file (members and managing staff). */
export const GET = route<{ id: string }>({}, async (_req, { user, params }) => {
  const sub = await prisma.projectSubmission.findUnique({ where: { id: params.id } });
  if (!sub?.fileKey) throw notFound();
  await loadTeam(user, sub.teamId);
  const body = await readUpload(sub.fileKey);
  return new Response(new Uint8Array(body), { headers: { "content-type": "application/octet-stream", "content-disposition": `attachment; filename="${(sub.fileName ?? "file").replace(/"/g, "")}"`, "x-content-type-options": "nosniff", "cache-control": "private, no-store" } });
});
