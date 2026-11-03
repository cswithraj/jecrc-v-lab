# Free deployment on Netlify

This puts JECRC VLab online at `https://<your-name>.netlify.app` using only free plans:

| Piece | Free service | Why |
|---|---|---|
| Web app | **Netlify** | Hosts the Next.js app |
| Database | **Neon** (PostgreSQL) | Netlify has no database |
| Code execution | **Judge0 CE on RapidAPI** | Netlify cannot run compilers, so code is sent to Judge0 |

## Free-tier limits (read this first)

- **Code runs are the bottleneck.** Judge0's free RapidAPI plan allows only a small number of submissions per day (check the current quota on its pricing page; at the time of writing it was 50/day). **Every test case counts as one submission**, so "Run tests" on an experiment with 4 tests uses 4. Enough for a demo, not for a class. For real practicals, upgrade the Judge0 plan or use the Docker/VPS setup in `DEPLOYMENT.md`.
- **File uploads are off.** Netlify functions have no permanent disk. Students share project work as links (GitHub, Google Drive).
- **Neon free:** 0.5 GB storage (plenty for this app); the database sleeps when idle, so the first page after a quiet period takes 1–2 s longer.
- **Netlify free:** 300 build minutes and 125,000 function calls a month; each server request must finish within 10 s.

## Step by step

### 1. Database (Neon), about 3 minutes
1. Go to https://neon.tech → **Sign up** (you can use your GitHub account).
2. **Create project** → name `jecrc-vlab` → Postgres 16 → region **US East (N. Virginia)** (closest to Netlify's servers) → **Create**.
3. On the project dashboard click **Connect**. Turn **Connection pooling OFF**, then copy the connection string. It looks like
   `postgresql://neondb_owner:xxxx@ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require`
4. Add `&connection_limit=3` to the end of it. Keep it for step 3.

### 2. Code execution (Judge0 on RapidAPI), about 3 minutes
1. Go to https://rapidapi.com/judge0-official/api/judge0-ce → **Sign up** / log in.
2. Open the **Pricing** tab → subscribe to **Basic (free)**.
3. Open the **Endpoints** tab and copy the value shown as **X-RapidAPI-Key**. Keep it for step 3.

### 3. Website (Netlify), about 10 minutes
1. Go to https://app.netlify.com → **Sign up with GitHub**.
2. **Add new site → Import an existing project → GitHub** → allow access → choose **cswithraj/jecrc-v-lab**.
3. Leave the build settings as they are (they come from `netlify.toml`). Before deploying, open **Add environment variables** (or later: **Site configuration → Environment variables**) and add:

| Key | Value |
|---|---|
| `DATABASE_URL` | the Neon string from step 1 (with `&connection_limit=3`) |
| `EXECUTION_PROVIDER` | `judge0` |
| `JUDGE0_URL` | `https://judge0-ce.p.rapidapi.com` |
| `JUDGE0_API_HOST` | `judge0-ce.p.rapidapi.com` |
| `JUDGE0_API_KEY` | the RapidAPI key from step 2 |
| `STORAGE_DRIVER` | `none` |
| `COOKIE_SECURE` | `true` |
| `SEED_DEMO` | `true` (creates demo labs and accounts on the first deploy) |
| `APP_URL` | `https://<your-site>.netlify.app` (fill in after step 4, then redeploy) |

4. Click **Deploy**. The first build takes about 5–8 minutes (it creates the tables and demo data).
5. Netlify shows your link, e.g. `https://lucky-otter-123.netlify.app`. Rename it under **Site configuration → Change site name** (e.g. `jecrc-vlab` → `https://jecrc-vlab.netlify.app`), set `APP_URL` to it, and **Deploys → Trigger deploy**.
6. Open the link and sign in: `student@vlab.demo`, `faculty@vlab.demo` or `admin@vlab.demo`, password `Demo@1234`.

Every push to the `main` branch on GitHub redeploys the site automatically.

### Going beyond a demo
- Set `SEED_DEMO` to `false` and create a real administrator from your computer:
  `DATABASE_URL='<neon string>' ADMIN_EMAIL=you@jecrcu.edu.in ADMIN_PASSWORD='Strong-pass-123' npx tsx scripts/create-admin.ts`
  then deactivate the demo accounts under **Admin → Users**.
- For full classes use the Docker setup (`docs/DEPLOYMENT.md`): it includes the built-in code runner with no daily limit.

## Troubleshooting
- **Build fails with "DATABASE_URL is not set"**: add the variable and redeploy.
- **"Can't reach database server"**: check you copied the *direct* (non-pooled) Neon string with `sslmode=require`.
- **Run/Submit says the execution service quota is used up**: the daily Judge0 free quota is finished; it resets the next day.
