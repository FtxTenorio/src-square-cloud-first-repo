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

# Nginx só roda como root (uid 0). Em ambiente sem root (ex.: Square Cloud) pula nginx.
if [ "$(id -u)" = "0" ]; then
  echo "[0/3] Root detectado: instalando/atualizando nginx..."
  apt-get update && apt-get install -y nginx
  echo "[1/3] Configurando nginx..."
  mkdir -p /etc/nginx/sites-enabled
  ln -sf "$ROOT/nginx/square-cloud.conf" /etc/nginx/sites-enabled/square-cloud.conf
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx
else
  echo "[nginx] Pulando (usuario nao e root). Em Square Cloud o proxy e gerenciado pela plataforma."
fi

# 2. Client: instala/builda só se precisar; depois sobe o build (porta 80)
echo "[2/3] Client..."
(cd "$ROOT/src/client" && \
  ( [ ! -d node_modules ] && npm install || true ) && \
  ( [ ! -d .next ] && echo "  Buildando (primeira vez ou build ausente)..." && npm run build || echo "  Rodando do build existente." ) && \
  npm run start) &

# 3. Server: instala só se precisar; depois sobe
echo "[3/3] Server..."
(cd "$ROOT/src/server" && \
  ( [ ! -d node_modules ] && npm install || true ) && \
  npm run start) &

wait
echo "[start.sh] Encerrado."
