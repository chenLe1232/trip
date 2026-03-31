#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

BRANCH="${DEPLOY_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
REMOTE="${DEPLOY_REMOTE:-origin}"

if ! command -v docker >/dev/null 2>&1; then
  echo "[deploy-update] docker 未安装，请先执行: systemctl start docker && systemctl enable docker"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "[deploy-update] docker 服务未启动，请先执行: systemctl start docker && systemctl enable docker"
  exit 1
fi

echo "[deploy-update] fetch ${REMOTE}/${BRANCH} ..."
git fetch "$REMOTE" "$BRANCH"

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "${REMOTE}/${BRANCH}")"

if [[ "$LOCAL_SHA" == "$REMOTE_SHA" ]]; then
  echo "[deploy-update] 无新代码，跳过重启"
  exit 0
fi

echo "[deploy-update] 检测到更新，切换到 ${REMOTE}/${BRANCH}"
git reset --hard "${REMOTE}/${BRANCH}"

echo "[deploy-update] 重建并重启容器"
docker compose down
docker compose build --pull
docker compose up -d --remove-orphans

echo "[deploy-update] 完成"
