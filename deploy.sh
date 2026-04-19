#!/usr/bin/env bash
# deploy.sh — Hive Finance Platform deployment script
# Fetches secrets from Bitwarden Secrets Manager, deploys via Docker Compose.
#
# This stack uses docker-compose.native-db.yml because postgres and redis run
# natively on the host (not in Docker containers).
#
# Prerequisites:
#   - bws CLI installed: https://bitwarden.com/help/secrets-manager-cli/
#   - BWS token stored in keyring: bws-set-token hive
#   - jq installed (apt install jq)
#   - Docker + Docker Compose installed
#
# Usage:
#   ./deploy.sh            # full deploy (token read from keyring)
#   ./deploy.sh --migrate  # force alembic upgrade head
#   ./deploy.sh --pull     # rebuild images only, no restart

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
BWS_PROJECT_ID="ae09c064-33fb-4fe7-aff1-b42000dca17c"  # HIVE project
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.native-db.yml"
MIGRATE=false
PULL_ONLY=false

# ── Parse args ───────────────────────────────────────────────────────────────
for arg in "$@"; do
  case $arg in
    --migrate) MIGRATE=true ;;
    --pull)    PULL_ONLY=true ;;
    *) echo "Unknown arg: $arg" && exit 1 ;;
  esac
done

# ── Preflight checks ─────────────────────────────────────────────────────────
echo "==> Preflight checks"

if ! command -v bws &>/dev/null; then
  echo "ERROR: bws not found. Install: https://bitwarden.com/help/secrets-manager-cli/"
  exit 1
fi

if [[ -z "${BWS_ACCESS_TOKEN:-}" ]]; then
  export BWS_ACCESS_TOKEN=$(secret-tool lookup service bws project hive 2>/dev/null || true)
fi

if [[ -z "${BWS_ACCESS_TOKEN:-}" ]]; then
  echo "ERROR: No BWS token found for project 'hive'."
  echo "  Store it with: bws-set-token hive"
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq not found. Install: apt install jq"
  exit 1
fi

if ! command -v docker &>/dev/null; then
  echo "ERROR: docker not found."
  exit 1
fi

# ── Fetch secrets from Bitwarden Secrets Manager ─────────────────────────────
echo "==> Fetching secrets from Bitwarden Secrets Manager"

# Ensure the token is exported so the bws process can see it
export BWS_ACCESS_TOKEN

# 1. Check if bws can actually authenticate
if ! bws project get "$BWS_PROJECT_ID" > /dev/null; then
  echo "ERROR: bws could not authenticate or project ID is invalid."
  exit 1
fi

# 2. Fetch and parse
if ! bws secret list "$BWS_PROJECT_ID" | jq -r '.[] | "\(.key)=\(.value)"' > "$ENV_FILE"; then
  echo "ERROR: Failed to fetch or parse secrets from Bitwarden."
  exit 1
fi

bWS_DEBUG=debug bws secret list "$BWS_PROJECT_ID" \
  | jq -r '.[] | "\(.key)=\(.value)"' \
  > "$ENV_FILE"

REQUIRED_KEYS=(
  POSTGRES_DB
  POSTGRES_USER
  POSTGRES_PASSWORD
  REDIS_PASSWORD
  PLAID_CLIENT_ID
  PLAID_SECRET
  SECRET_KEY
)
WARN_KEYS=(
  ANTHROPIC_API_KEY
)

MISSING=()
for key in "${REQUIRED_KEYS[@]}"; do
  if ! grep -q "^${key}=" "$ENV_FILE"; then
    MISSING+=("$key")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "ERROR: Missing required secrets in BWS project HIVE:"
  for k in "${MISSING[@]}"; do echo "  - $k"; done
  echo "  Add them at: https://vault.bitwarden.com (Secrets Manager → HIVE project)"
  shred -u "$ENV_FILE" 2>/dev/null || rm -f "$ENV_FILE"
  exit 1
fi

for key in "${WARN_KEYS[@]}"; do
  if ! grep -q "^${key}=" "$ENV_FILE"; then
    echo "  WARNING: $key not in BWS — AI chat and Claude categorization fallback disabled."
  fi
done

SECRET_COUNT=$(wc -l < "$ENV_FILE")
echo "  Loaded $SECRET_COUNT secrets into ephemeral .env"

# ── Change to project directory ───────────────────────────────────────────────
cd "$SCRIPT_DIR"

# ── Build images ──────────────────────────────────────────────────────────────
echo "==> Building images"
$COMPOSE build --parallel

if [[ "$PULL_ONLY" == true ]]; then
  echo "==> --pull mode: images rebuilt. Exiting without starting services."
  shred -u "$ENV_FILE" 2>/dev/null || rm -f "$ENV_FILE"
  exit 0
fi

# ── Free port 8080 before starting nginx container ──────────────────────────
echo "==> Checking for processes on port 8080"

# Stop system nginx service if it's running (one-time: disable it permanently)
if systemctl is-active --quiet nginx 2>/dev/null; then
  echo "  System nginx service is active — stopping it"
  if sudo systemctl stop nginx 2>/dev/null; then
    echo "  Stopped. Run 'sudo systemctl disable nginx' to prevent it starting on reboot."
  else
    echo "  WARNING: Could not stop system nginx. Run: sudo systemctl disable --now nginx"
    echo "  Then re-run deploy.sh"
    shred -u "$ENV_FILE" 2>/dev/null || rm -f "$ENV_FILE"
    exit 1
  fi
fi

# ── Database migrations ───────────────────────────────────────────────────────
echo "==> Running Alembic migrations"

# With native-db overlay, postgres stub is instant — no need to wait
$COMPOSE up -d postgres redis

# Run migrations in a throwaway backend container
$COMPOSE run --rm \
  -e POSTGRES_HOST=127.0.0.1 \
  backend \
  alembic upgrade head

echo "  Migrations complete."

# ── Start full stack ──────────────────────────────────────────────────────────
echo "==> Starting all services"
$COMPOSE up -d

echo "  Waiting for backend health check..."
timeout 120 bash -c "until $COMPOSE ps backend | grep -q healthy; do sleep 3; done"

echo "  Waiting for frontend health check..."
timeout 120 bash -c "until $COMPOSE ps frontend | grep -q healthy; do sleep 3; done"

# ── Shred the ephemeral .env ──────────────────────────────────────────────────
echo "==> Shredding ephemeral .env"
shred -u "$ENV_FILE" 2>/dev/null || rm -f "$ENV_FILE"
echo "  Done. Secrets cleared from disk."

# ── Status ────────────────────────────────────────────────────────────────────
echo ""
echo "==> Stack status"
$COMPOSE ps

echo ""
echo "✓ Hive is live."
echo "  Dashboard: http://$(hostname -I | awk '{print $1}'):8080"
echo "  Logs:      docker compose logs -f [service]"
echo "  Stop:      $COMPOSE down"
