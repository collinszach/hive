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
#   ./deploy.sh --migrate  # accepted for compatibility; a no-op. `alembic upgrade
#                          #   head` already runs on every deploy.
#   ./deploy.sh --pull     # rebuild images only, no restart

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
COMPOSE="docker compose -f docker-compose.yml"
PUBLIC_URL="https://hive.zacharyjcollins.com"
PUBLIC_HEALTH_URL="$PUBLIC_URL/api/health"
# Parsed for compatibility only — migrations run unconditionally below.
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

# The web app is NOT served from this compose file — the frontend is hosted on
# Vercel, and the public domain is fronted by a shared reverse proxy outside this
# stack. This probe is therefore informational only: a failure here means the
# proxy or DNS needs attention, not that the backend deploy went wrong, so it
# must never fail the deploy.
echo "  Probing public endpoint (informational)..."
if curl -fs -o /dev/null --max-time 15 "$PUBLIC_HEALTH_URL"; then
  echo "  Public endpoint OK: $PUBLIC_HEALTH_URL"
else
  echo "  NOTE: could not reach $PUBLIC_HEALTH_URL — backend is healthy locally,"
  echo "        so check the reverse proxy / DNS if the site looks down."
fi

# ── Status ────────────────────────────────────────────────────────────────────
echo ""
echo "==> Stack status"
$COMPOSE ps

echo ""
echo "✓ Hive backend is live."
echo "  Public:    $PUBLIC_URL  (frontend deploys separately via Vercel)"
echo "  Local API: http://$(hostname -I | awk '{print $1}'):8000/health"
echo "  Logs:      docker compose logs -f [service]"
echo "  Stop:      $COMPOSE down"
