// Netlify build: apply database migrations, seed demo data when SEED_DEMO=true, then build Next.js.
import { execSync } from "node:child_process";
const run = (cmd) => { console.log(`\n$ ${cmd}`); execSync(cmd, { stdio: "inherit" }); };
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL is not set. Add it under Site configuration → Environment variables."); process.exit(1); }
run("npx prisma migrate deploy");
if (process.env.SEED_DEMO === "true") run("npx tsx prisma/seed.ts");
else console.log("SEED_DEMO is not true: skipping demo data.");
run("npx next build");
