#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# 0. Nginx: install (if not present) — run this script as root (e.g. su então ./start.sh)
apt-get update && apt-get install -y nginx

# 1. Nginx: config + reload
ln -sf "$ROOT/nginx/square-cloud.conf" /etc/nginx/sites-enabled/square-cloud.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# 2. Client (install, build, start in background)
(cd "$ROOT/src/client" && pnpm install && pnpm build && pnpm start) &

# 3. Server (install, start in background)
(cd "$ROOT/src/server" && pnpm install && pnpm start) &

wait
