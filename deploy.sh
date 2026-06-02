#!/usr/bin/env bash
# deploy.sh — Hive Finance Platform deployment script
# Uses a persistent local .env file for secrets (no Bitwarden required).
#
# Prerequisites:
#   - .env file present in project root with all required secrets
#   - jq installed (apt install jq)
#   - Docker + Docker Compose installed
#
# Usage:
#   ./deploy.sh            # full deploy
#   ./deploy.sh --migrate  # force alembic upgrade head
#   ./deploy.sh --pull     # rebuild images only, no restart

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
COMPOSE="docker compose -f docker-compose.yml"
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
  echo "  Copy .env.example to .env and fill in your secrets."
  exit 1
fi

if ! command -v docker &>/dev/null; then
  echo "ERROR: docker not found."
  exit 1
fi

# ── Validate required secrets ─────────────────────────────────────────────────
echo "==> Validating secrets in .env"

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
  echo "ERROR: Missing required secrets in .env:"
  for k in "${MISSING[@]}"; do echo "  - $k"; done
  exit 1
fi

for key in "${WARN_KEYS[@]}"; do
  if ! grep -q "^${key}=" "$ENV_FILE"; then
    echo "  WARNING: $key not in .env — AI chat and Claude categorization fallback disabled."
  fi
done

SECRET_COUNT=$(grep -c "^[A-Z]" "$ENV_FILE" || true)
echo "  Found $SECRET_COUNT secrets in .env"

# ── Change to project directory ───────────────────────────────────────────────
cd "$SCRIPT_DIR"

# ── Build images ──────────────────────────────────────────────────────────────
echo "==> Building images"
$COMPOSE build --parallel

if [[ "$PULL_ONLY" == true ]]; then
  echo "==> --pull mode: images rebuilt. Exiting without starting services."
  exit 0
fi

# ── Free port 8080 before starting nginx container ──────────────────────────
echo "==> Checking for processes on port 8080"

if systemctl is-active --quiet nginx 2>/dev/null; then
  echo "  System nginx service is active — stopping it"
  if sudo systemctl stop nginx 2>/dev/null; then
    echo "  Stopped. Run 'sudo systemctl disable nginx' to prevent it starting on reboot."
  else
    echo "  WARNING: Could not stop system nginx. Run: sudo systemctl disable --now nginx"
    echo "  Then re-run deploy.sh"
    exit 1
  fi
fi

# ── Free port 6380 before starting redis container ───────────────────────────
# hive-redis uses host networking and binds 127.0.0.1:6380. If a previous
# container was removed without its process being reaped (e.g. a dockerd
# restart), the stray redis-server keeps the port and the new container
# crash-loops on "Address in use". Reap any such orphan that no running
# container owns. Uses a --pid=host helper so no interactive sudo is needed.
echo "==> Checking for orphan redis on port 6380"

if pgrep -f "redis-server 127.0.0.1:6380" >/dev/null 2>&1; then
  if ! docker ps --format '{{.Names}}' | grep -q '^hive-redis-1$'; then
    echo "  Found orphan redis on 6380 with no running container — reaping"
    for pid in $(pgrep -f "redis-server 127.0.0.1:6380"); do
      docker run --rm --pid=host --entrypoint kill redis:7-alpine -9 "$pid" || true
    done
  fi
fi

# ── Database migrations ───────────────────────────────────────────────────────
echo "==> Running Alembic migrations"

$COMPOSE up -d --remove-orphans postgres redis

# Run migrations in a throwaway backend container
$COMPOSE run --rm \
  -e POSTGRES_HOST=127.0.0.1 \
  backend \
  alembic upgrade head

echo "  Migrations complete."

# ── Start full stack ──────────────────────────────────────────────────────────
echo "==> Starting all services"
$COMPOSE up -d --remove-orphans

echo "  Waiting for backend health check..."
timeout 120 bash -c "until $COMPOSE ps backend | grep -q healthy; do sleep 3; done"

# The web app is served by nginx (there is no separate `frontend` compose
# service). nginx has no Docker healthcheck, so probe its HTTP port directly.
echo "  Waiting for nginx (web) to serve..."
timeout 120 bash -c 'until curl -fs -o /dev/null http://localhost:8080/api/health; do sleep 3; done'

# ── Status ────────────────────────────────────────────────────────────────────
echo ""
echo "==> Stack status"
$COMPOSE ps

echo ""
echo "✓ Hive is live."
echo "  Dashboard: http://$(hostname -I | awk '{print $1}'):8080"
echo "  Logs:      docker compose logs -f [service]"
echo "  Stop:      $COMPOSE down"
