# ── JECRC VLab web app (Next.js standalone) ──
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY scripts ./scripts
RUN npm ci

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production dependencies only. Next's file tracing misses some runtime files of pdfkit/exceljs
# dependencies, so the runtime image ships the full pruned node_modules instead of the traced subset.
FROM build AS prod-deps
RUN npm prune --omit=dev

# One-shot image used by the "migrate" service: applies migrations and (optionally) seeds demo data.
FROM deps AS migrate
COPY . .
CMD ["sh", "-c", "npx prisma migrate deploy && if [ \"$SEED_DEMO\" = \"true\" ]; then npx tsx prisma/seed.ts; fi"]

FROM node:22-bookworm-slim AS web
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
 && groupadd -r vlab && useradd -r -g vlab -d /app vlab
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 STORAGE_DIR=/app/storage
COPY --from=build --chown=vlab:vlab /app/.next/standalone ./
COPY --from=prod-deps --chown=vlab:vlab /app/node_modules ./node_modules
COPY --from=build --chown=vlab:vlab /app/.next/static ./.next/static
COPY --from=build --chown=vlab:vlab /app/public ./public
RUN mkdir -p /app/storage && chown vlab:vlab /app/storage
USER vlab
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
