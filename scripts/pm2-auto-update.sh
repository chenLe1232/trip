#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

INTERVAL_SECONDS="${INTERVAL_SECONDS:-300}"

echo "[pm2-auto-update] 每 ${INTERVAL_SECONDS}s 检查更新并部署"

while true; do
  ./scripts/deploy-update.sh || true
  sleep "$INTERVAL_SECONDS"
done
