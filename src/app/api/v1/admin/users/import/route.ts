import { route, badRequest } from "@/lib/api";
import { importUsers } from "@/lib/services/admin";

/** POST /api/v1/admin/users/import (multipart file=.csv) — bulk create users. */
export const POST = route({ permission: "users.manage" }, async (req, { user }) => {
  const file = (await req.formData()).get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv")) throw badRequest("Upload a .csv file.");
  if (file.size > 2 * 1024 * 1024) throw badRequest("File too large (2 MB max).");
  return importUsers(user, await file.text());
});
