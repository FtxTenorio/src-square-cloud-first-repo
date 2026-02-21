#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# === Ambiente / visibilidade do sistema ===
echo "=============================================="
echo "[start.sh] $(date -Iseconds 2>/dev/null || date)"
echo "=============================================="
echo "[Sistema] $(uname -a)"
if [ -f /etc/os-release ]; then
  echo "[Distro] $(grep -E '^(NAME|VERSION)=' /etc/os-release | sed 's/^/  /')"
fi
echo "[Usuario] $(whoami) (uid=$(id -u 2>/dev/null || echo '?') gid=$(id -g 2>/dev/null || echo '?'))"
echo "[Diretorio] ROOT=$ROOT | PWD=$PWD"
echo "[PATH] $PATH"
echo "=============================================="

# 0. Nginx: install (if not present) — run this script as root (e.g. su então ./start.sh)
echo "[0/3] Instalando/atualizando nginx..."
apt-get update && apt-get install -y nginx

# 1. Nginx: config + reload
echo "[1/3] Configurando nginx..."
mkdir -p /etc/nginx/sites-enabled
ln -sf "$ROOT/nginx/square-cloud.conf" /etc/nginx/sites-enabled/square-cloud.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# 2. Client (install, build, start in background)
echo "[2/3] Iniciando client (background)..."
(cd "$ROOT/src/client" && pnpm install && pnpm build && pnpm start) &

# 3. Server (install, start in background)
echo "[3/3] Iniciando server (background)..."
(cd "$ROOT/src/server" && pnpm install && pnpm start) &

wait
echo "[start.sh] Encerrado."
