#!/usr/bin/env bash
set -euo pipefail

WEBHOOK_URL="${1:-http://flow-openapi.aliyun.com/scm/webhook/LNInEMKX9Qe0HqAHny1F}"

echo "Triggering Codeup webhook: ${WEBHOOK_URL}"
curl -sS -X POST "${WEBHOOK_URL}" \
  -H 'Content-Type: application/json' \
  -d '{"event":"manual-trigger","source":"trip-repo"}'

echo
echo "Done."
