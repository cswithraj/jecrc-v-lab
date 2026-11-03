# Deployment

## 1. Single server with Docker Compose

A 4 vCPU / 8 GB Linux VM comfortably serves a lab of ~60 concurrent students. Code execution is the heaviest load; scale `RUNNER_CONCURRENCY` and the runner's CPU/memory limits first.

```bash
git clone https://github.com/cswithraj/jecrc-v-lab.git && cd jecrc-v-lab
cp .env.docker.example .env.docker
# Edit .env.docker: long random POSTGRES_PASSWORD and RUNNER_SECRET (openssl rand -base64 32),
# APP_URL=https://vlab.your-domain, COOKIE_SECURE=true, SEED_DEMO=false for production.
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker logs -f web
```

Services:

| Service | Role | Networks |
|---|---|---|
| `db` | PostgreSQL 16, data in volume `pgdata` | backend (internal) |
| `migrate` | Runs `prisma migrate deploy` (and the demo seed if `SEED_DEMO=true`), then exits | backend |
| `runner` | Compiles and runs student code. Read-only filesystem, tmpfs `/tmp`, dropped capabilities, CPU/memory/PID limits, per-job unprivileged uid, rlimits. **No internet access**: it is only on the internal `sandbox` network. | sandbox (internal) |
| `web` | Next.js app (standalone build), uploads in volume `uploads` | backend, sandbox, frontend |
| `nginx` | Reverse proxy on port 80 | frontend |

### First administrator (production, no demo data)

```bash
docker compose --env-file .env.docker run --rm \
  -e ADMIN_EMAIL=admin@your-domain -e ADMIN_PASSWORD='a-strong-password-123' -e ADMIN_NAME='Your Name' \
  migrate npx tsx scripts/create-admin.ts
```

Then sign in, and create courses, sessions, batches, laboratories and classes under **Administration**. The 14 laboratory catalogues can be loaded by running the seed once with `SEED_DEMO=true` on a staging copy and exporting/importing the question banks, or by importing your own CSV/Excel files.

## 2. HTTPS

Either put the server behind your university load balancer / Cloudflare (TLS terminated there, forward `X-Forwarded-Proto`), or terminate TLS in Nginx:

```nginx
server { listen 80; server_name vlab.example.edu; return 301 https://$host$request_uri; }
server {
  listen 443 ssl http2; server_name vlab.example.edu;
  ssl_certificate     /etc/letsencrypt/live/vlab.example.edu/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/vlab.example.edu/privkey.pem;
  add_header Strict-Transport-Security "max-age=31536000" always;
  # ...same locations as deploy/nginx/vlab.conf
}
```

Mount the certificates into the `nginx` container and publish port 443. Keep `COOKIE_SECURE=true` behind HTTPS.

## 3. Backups

```bash
# nightly database dump (keep 14 days)
docker compose --env-file .env.docker exec -T db pg_dump -U vlab -Fc vlab > backups/vlab-$(date +%F).dump
# uploads volume
docker run --rm -v jecrc-vlab_uploads:/data -v "$PWD/backups":/out alpine tar czf /out/uploads-$(date +%F).tgz -C /data .
```

Restore with `pg_restore --clean -d vlab` inside the `db` container. Test a restore every semester.

## 4. Scaling

- **More students at once:** raise `RUNNER_CONCURRENCY` (≈ CPU cores − 1) and `RUNNER_CPUS`/`RUNNER_MEM_LIMIT`; or run several runner containers behind an internal load balancer and point `RUNNER_URL` at it.
- **Several web instances:** the in-memory rate limiter is per instance; move it to Redis before scaling `web` horizontally. Sessions are in PostgreSQL, so no sticky sessions are needed. Uploads must then live on shared storage (NFS volume) since only the `local` storage driver is implemented.
- **Judge0 instead of the built-in runner:** set `EXECUTION_PROVIDER=judge0`, `JUDGE0_URL` and `JUDGE0_KEY`.

## 5. Hardening checklist

- [ ] `SEED_DEMO=false`; delete any `@vlab.demo` accounts (Admin → Users → filter, deactivate).
- [ ] Strong unique `POSTGRES_PASSWORD` and `RUNNER_SECRET`; `.env.docker` readable only by root.
- [ ] HTTPS with HSTS; `COOKIE_SECURE=true`.
- [ ] Only ports 80/443 exposed; database and runner are on internal networks.
- [ ] Host kernel kept patched (the runner relies on kernel isolation); consider gVisor (`runtime: runsc`) for the runner container for an extra boundary.
- [ ] Nightly backups copied off the server.
- [ ] Review the audit log after each examination.

## 6. Upgrades

```bash
git pull && docker compose --env-file .env.docker up -d --build
```

The `migrate` service applies new migrations before `web` starts.

## Where this cannot run

Static or serverless hosts (Vercel, Netlify, GitHub Pages) cannot run the code runner, which needs a long-running Linux container with compilers. You can host `web` on such a platform only if `runner` (or Judge0) runs elsewhere and is reachable over a private, authenticated connection. A small VM (university data centre, AWS Lightsail, DigitalOcean, Azure) with Docker is the simplest supported setup.
