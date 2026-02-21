#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "[start-back] Iniciando server (Fastify)..."
cd "$ROOT/src/server"
npm install --no-audit --no-fund
npm run start
