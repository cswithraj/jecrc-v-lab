# ── JECRC VLab code runner ──
# Compilers/interpreters + sandbox tools. The service starts as root only so it can drop each job
# to a per-slot unprivileged uid (setpriv); student code never runs as root.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      gcc g++ libc6-dev make default-jdk-headless python3 sqlite3 \
      util-linux procps ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g tsx@4.19.2
WORKDIR /srv/runner
COPY services/runner/ ./
ENV RUNNER_PORT=4100 RUNNER_WORKDIR=/tmp RUNNER_UNSHARE_NET=false TMPDIR=/tmp
EXPOSE 4100
CMD ["tsx", "server.ts"]
