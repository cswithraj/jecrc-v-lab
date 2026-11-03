import { route } from "@/lib/api";
export const GET = route({}, async (_req, { user }) => ({ user }));
