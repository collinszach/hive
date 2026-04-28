#!/usr/bin/env bash
# deploy.sh — Hive Finance Platform deployment script
# Reads secrets from a permanent .env file at the repo root.
#
# This stack uses docker-compose.native-db.yml because postgres and redis run
# natively on the host (not in Docker containers).
#
# Prerequisites:
#   - .env file present at repo root (copy from .env.example and fill in values)
#   - Docker + Docker Compose installed
#
# Usage:
#   ./deploy.sh            # full deploy
#   ./deploy.sh --migrate  # force alembic upgrade head
#   ./deploy.sh --pull     # rebuild images only, no restart

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
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

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env file not found at $ENV_FILE"
  echo "  Copy .env.example to .env and fill in your values."
  exit 1
fi

if ! command -v docker &>/dev/null; then
  echo "ERROR: docker not found."
  exit 1
fi

REQUIRED_KEYS=(
  POSTGRES_DB
  POSTGRES_USER
  POSTGRES_PASSWORD
  REDIS_PASSWORD
  PLAID_CLIENT_ID
  PLAID_SECRET
  SECRET_KEY
  FERNET_KEY
)
WARN_KEYS=(
  ANTHROPIC_API_KEY
  PLAID_WEBHOOK_SECRET
  PLAID_WEBHOOK_URL
)

MISSING=()
for key in "${REQUIRED_KEYS[@]}"; do
  if ! grep -q "^${key}=" "$ENV_FILE"; then
    MISSING+=("$key")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "ERROR: Missing required keys in .env:"
  for k in "${MISSING[@]}"; do echo "  - $k"; done
  exit 1
fi

for key in "${WARN_KEYS[@]}"; do
  if ! grep -q "^${key}=" "$ENV_FILE"; then
    echo "  WARNING: $key not set — some features may be disabled."
  fi
done

SECRET_COUNT=$(grep -c "^[A-Z]" "$ENV_FILE" || true)
echo "  .env loaded ($SECRET_COUNT keys)"

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

# ── Status ────────────────────────────────────────────────────────────────────
echo ""
echo "==> Stack status"
$COMPOSE ps

echo ""
echo "✓ Hive is live."
echo "  Dashboard: http://$(hostname -I | awk '{print $1}'):8080"
echo "  Logs:      docker compose logs -f [service]"
echo "  Stop:      $COMPOSE down"
