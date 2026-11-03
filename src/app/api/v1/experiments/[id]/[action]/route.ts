import { route, notFound } from "@/lib/api";
import { setStatus, duplicateExperiment } from "@/lib/services/experiments";

/** POST /api/v1/experiments/:id/publish | unpublish | archive | duplicate */
export const POST = route<{ id: string; action: string }>({ permission: "experiments.manage" }, async (_req, { user, params }) => {
  switch (params.action) {
    case "publish": return setStatus(user, params.id, "PUBLISHED");
    case "unpublish": return setStatus(user, params.id, "DRAFT");
    case "archive": return setStatus(user, params.id, "ARCHIVED");
    case "duplicate": return duplicateExperiment(user, params.id);
  }
  throw notFound("Unknown action.");
});
