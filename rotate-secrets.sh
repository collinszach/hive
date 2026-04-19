#!/usr/bin/env bash
# rotate-secrets.sh — Re-fetch secrets from BWS and hot-reload services
# Use this after rotating any credential in Bitwarden Secrets Manager.
# Services are restarted one at a time to minimize downtime.
#
# Usage:
#   BWS_ACCESS_TOKEN=<token> ./rotate-secrets.sh
#   BWS_ACCESS_TOKEN=<token> ./rotate-secrets.sh --service backend  # single service only

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
TARGET_SERVICE="${2:-}"  # optional: --service <name>

for i in "$@"; do
  case $i in
    --service) shift; TARGET_SERVICE="${1:-}"; shift ;;
  esac
done

# ── Preflight ─────────────────────────────────────────────────────────────────
if [[ -z "${BWS_ACCESS_TOKEN:-}" ]]; then
  echo "ERROR: BWS_ACCESS_TOKEN not set."
  exit 1
fi

# ── Fetch updated secrets ─────────────────────────────────────────────────────
echo "==> Fetching updated secrets from BWS"
BWS_PROJECT_ID="ae09c064-33fb-4fe7-aff1-b42000dca17c"  # HIVE project
bws secret list "$BWS_PROJECT_ID" 2>/dev/null \
  | jq -r '.[] | "\(.key)=\(.value)"' \
  > "$ENV_FILE"
echo "  Secrets written."

cd "$SCRIPT_DIR"

# ── Restart services ──────────────────────────────────────────────────────────
if [[ -n "$TARGET_SERVICE" ]]; then
  echo "==> Restarting $TARGET_SERVICE"
  docker compose up -d --force-recreate "$TARGET_SERVICE"
else
  # Rolling restart: beat → worker → backend → frontend
  echo "==> Rolling restart of all services"
  for svc in celery_beat celery_worker backend frontend; do
    echo "  Restarting $svc..."
    docker compose up -d --force-recreate "$svc"
    sleep 3
  done
fi

# ── Shred .env ────────────────────────────────────────────────────────────────
echo "==> Shredding ephemeral .env"
shred -u "$ENV_FILE" 2>/dev/null || rm -f "$ENV_FILE"

echo ""
echo "✓ Secrets rotated and services restarted."
