#!/usr/bin/env bash
# rotate-secrets.sh — Hot-reload services after updating .env secrets.
# Edit .env with the new values, then run this script to apply them.
#
# Usage:
#   ./rotate-secrets.sh                    # rolling restart of all services
#   ./rotate-secrets.sh --service backend  # restart a single service only

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
TARGET_SERVICE=""

for i in "$@"; do
  case $i in
    --service) shift; TARGET_SERVICE="${1:-}"; shift ;;
  esac
done

# ── Preflight ─────────────────────────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env file not found at $ENV_FILE"
  exit 1
fi

cd "$SCRIPT_DIR"

# ── Restart services ──────────────────────────────────────────────────────────
if [[ -n "$TARGET_SERVICE" ]]; then
  echo "==> Restarting $TARGET_SERVICE"
  docker compose -f docker-compose.yml -f docker-compose.native-db.yml up -d --force-recreate "$TARGET_SERVICE"
else
  # Rolling restart: beat → worker → backend → frontend
  echo "==> Rolling restart of all services"
  for svc in celery_beat celery_worker backend frontend; do
    echo "  Restarting $svc..."
    docker compose -f docker-compose.yml -f docker-compose.native-db.yml up -d --force-recreate "$svc"
    sleep 3
  done
fi

echo ""
echo "✓ Services restarted with updated .env."
