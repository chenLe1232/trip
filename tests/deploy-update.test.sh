#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

REPO_DIR="$TMP_DIR/repo"
BIN_DIR="$TMP_DIR/bin"
STATE_FILE="$TMP_DIR/git-state"
DOCKER_LOG="$TMP_DIR/docker.log"

mkdir -p "$REPO_DIR/scripts" "$BIN_DIR"
cp "$ROOT_DIR/scripts/deploy-update.sh" "$REPO_DIR/scripts/deploy-update.sh"
chmod +x "$REPO_DIR/scripts/deploy-update.sh"

cat > "$STATE_FILE" <<'EOF'
CURRENT_BRANCH=main
LOCAL_SHA=old-local
REMOTE_TRACKING_SHA=old-local
ACTUAL_REMOTE_SHA=new-remote
FETCH_HEAD_SHA=old-local
EOF

cat > "$BIN_DIR/git" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

STATE_FILE="${STATE_FILE:?}"
. "$STATE_FILE"

write_state() {
  cat > "$STATE_FILE" <<STATE
CURRENT_BRANCH=$CURRENT_BRANCH
LOCAL_SHA=$LOCAL_SHA
REMOTE_TRACKING_SHA=$REMOTE_TRACKING_SHA
ACTUAL_REMOTE_SHA=$ACTUAL_REMOTE_SHA
FETCH_HEAD_SHA=$FETCH_HEAD_SHA
STATE
}

case "$*" in
  "rev-parse --abbrev-ref HEAD")
    printf '%s\n' "$CURRENT_BRANCH"
    ;;
  "fetch origin")
    REMOTE_TRACKING_SHA="$ACTUAL_REMOTE_SHA"
    FETCH_HEAD_SHA="$ACTUAL_REMOTE_SHA"
    write_state
    printf 'From fake-remote\n'
    printf '   %s..%s  main       -> origin/main\n' "$LOCAL_SHA" "$ACTUAL_REMOTE_SHA"
    ;;
  "fetch origin main")
    FETCH_HEAD_SHA="$ACTUAL_REMOTE_SHA"
    write_state
    printf 'From fake-remote\n'
    printf ' * branch            main       -> FETCH_HEAD\n'
    ;;
  "rev-parse HEAD")
    printf '%s\n' "$LOCAL_SHA"
    ;;
  "rev-parse origin/main")
    printf '%s\n' "$REMOTE_TRACKING_SHA"
    ;;
  "reset --hard origin/main")
    LOCAL_SHA="$REMOTE_TRACKING_SHA"
    write_state
    printf 'HEAD is now at %s\n' "$LOCAL_SHA"
    ;;
  *)
    printf 'unexpected git invocation: %s\n' "$*" >&2
    exit 1
    ;;
esac
EOF
chmod +x "$BIN_DIR/git"

cat > "$BIN_DIR/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

DOCKER_LOG="${DOCKER_LOG:?}"

if [[ "${1:-}" == "info" ]]; then
  exit 0
fi

if [[ "${1:-}" == "compose" ]]; then
  printf '%s\n' "$*" >> "$DOCKER_LOG"
  exit 0
fi

printf 'unexpected docker invocation: %s\n' "$*" >&2
exit 1
EOF
chmod +x "$BIN_DIR/docker"

pushd "$REPO_DIR" >/dev/null
OUTPUT="$(
  PATH="$BIN_DIR:$PATH" \
  STATE_FILE="$STATE_FILE" \
  DOCKER_LOG="$DOCKER_LOG" \
  DEPLOY_REMOTE=origin \
  DEPLOY_BRANCH=main \
  bash ./scripts/deploy-update.sh 2>&1
)"
popd >/dev/null

if [[ "$OUTPUT" == *"无新代码，跳过重启"* ]]; then
  printf 'deploy-update.sh incorrectly skipped a remote update\n%s\n' "$OUTPUT" >&2
  exit 1
fi

if [[ ! -f "$DOCKER_LOG" ]]; then
  printf 'expected docker compose commands to run\n%s\n' "$OUTPUT" >&2
  exit 1
fi

grep -q '^compose down$' "$DOCKER_LOG"
grep -q '^compose build --pull$' "$DOCKER_LOG"
grep -q '^compose up -d --remove-orphans$' "$DOCKER_LOG"

grep -q '^LOCAL_SHA=new-remote$' "$STATE_FILE"
