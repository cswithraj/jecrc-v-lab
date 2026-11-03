#!/usr/bin/env bash
# One-command install of JECRC VLab on a fresh Ubuntu 22.04/24.04 server (2+ vCPU, 4+ GB RAM).
#   curl -fsSL https://raw.githubusercontent.com/cswithraj/jecrc-v-lab/main/deploy/install.sh | sudo bash
# Optional: DOMAIN=vlab.example.edu (its DNS A record must point at this server). Without it the site is
# served at https://<server-ip-with-dashes>.sslip.io. DEMO=false installs without demo accounts.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo)."; exit 1; }
REPO="${REPO:-https://github.com/cswithraj/jecrc-v-lab.git}"
DIR="${DIR:-/opt/jecrc-vlab}"
DEMO="${DEMO:-true}"

echo "==> Installing Docker"
if ! command -v docker >/dev/null; then curl -fsSL https://get.docker.com | sh; fi
apt-get install -y git >/dev/null 2>&1 || true

echo "==> Fetching the application"
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only; else git clone --depth 1 "$REPO" "$DIR"; fi
cd "$DIR"

IP="$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}')"
SITE="${DOMAIN:-${IP//./-}.sslip.io}"

if [ ! -f .env.docker ]; then
  echo "==> Writing .env.docker with random secrets"
  rnd() { openssl rand -base64 36 | tr -dc 'A-Za-z0-9' | head -c 32; }
  cat > .env.docker <<ENV
POSTGRES_DB=vlab
POSTGRES_USER=vlab
POSTGRES_PASSWORD=$(rnd)
RUNNER_SECRET=$(rnd)
APP_URL=https://${SITE}
SITE_ADDRESS=${SITE}
SEED_DEMO=${DEMO}
COOKIE_SECURE=true
HTTP_PORT=127.0.0.1:8080
RUNNER_CONCURRENCY=$(( $(nproc) > 1 ? $(nproc) - 1 : 1 ))
ENV
  chmod 600 .env.docker
fi

echo "==> Building and starting (first run takes 5-10 minutes)"
docker compose --env-file .env.docker -f docker-compose.yml -f deploy/docker-compose.https.yml up -d --build

echo
echo "JECRC VLab is starting at: https://${SITE}"
[ "$DEMO" = "true" ] && echo "Demo logins (password Demo@1234): student@vlab.demo, faculty@vlab.demo, admin@vlab.demo"
echo "Create your own administrator:"
echo "  cd $DIR && docker compose --env-file .env.docker run --rm -e ADMIN_EMAIL=you@uni.edu -e ADMIN_PASSWORD='Strong-pass-123' migrate npx tsx scripts/create-admin.ts"
