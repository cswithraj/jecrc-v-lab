import { route, parseBody } from "@/lib/api";
import { OfferingCreate, createOffering } from "@/lib/services/admin";

/** POST /api/v1/admin/offerings — create a class (lab × batch × session), optionally enrolling the whole batch. */
export const POST = route({ permission: "academics.manage" }, async (req, { user }) => createOffering(user, await parseBody(req, OfferingCreate)));
