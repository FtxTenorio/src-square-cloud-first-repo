#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# 1. Nginx: config + reload
sudo ln -sf "$ROOT/nginx/square-cloud.conf" /etc/nginx/sites-enabled/square-cloud.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# 2. Client (install, build, start in background)
(cd "$ROOT/src/client" && pnpm install && pnpm build && pnpm start) &

# 3. Server (install, start in background)
(cd "$ROOT/src/server" && pnpm install && pnpm start) &

wait
