#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "[start-front] Iniciando client (Next.js)..."
cd "$ROOT/src/client"
npm install --no-audit --no-fund
NODE_OPTIONS="--max-old-space-size=384" npm run build
npm run start
