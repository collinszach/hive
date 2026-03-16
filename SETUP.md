# SETUP.md — One-Time Setup Guide

## Step 1: NUC Prerequisites

SSH into your NUC and run:

```bash
# Install Docker
sudo apt update && sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker

# Install Ollama on HOST (not in Docker)
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2
# Verify: curl http://localhost:11434/api/tags

# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# Follow the auth URL that appears. Note your NUC's Tailscale hostname.

# Install Git
sudo apt install -y git
```

## Step 2: MacBook Prerequisites

```bash
# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Install Tailscale
# Download from: https://tailscale.com/download/mac
# Log in with same account as NUC

# Verify NUC is visible:
ping $(tailscale ip -4)  # should respond
```

## Step 3: API Keys to Get Before Starting

| Service | Where to Get | Free Tier |
|---|---|---|
| Plaid | dashboard.plaid.com → Developers → Keys | 200 API calls in Development |
| Anthropic | console.anthropic.com/settings/keys | Pay per token (~$0.30/mo for this use case) |
| SnapTrade | dashboard.snaptrade.com | 5 free brokerage connections |

## Step 4: Clone & Configure

```bash
# On MacBook, from your projects directory:
git init finance-platform
cd finance-platform

# Copy in the files from this package
# (CLAUDE.md, BUILD_PLAN.md, SPEC.md, PROMPTS.md, .env.example are already here)

# Create your .env file
cp .env.example .env

# Fill in your real values:
nano .env
# Required minimums to start:
#   POSTGRES_PASSWORD=<anything strong>
#   PLAID_CLIENT_ID=<from Plaid dashboard>
#   PLAID_SECRET=<from Plaid dashboard>
#   ANTHROPIC_API_KEY=<from Anthropic console>
#   SECRET_KEY=<run: openssl rand -hex 32>

# Initialize git (important — keeps track of Claude Code's changes)
git add CLAUDE.md BUILD_PLAN.md SPEC.md PROMPTS.md .env.example
git commit -m "Initial project scaffold resources"
echo ".env" >> .gitignore
echo "*.pyc" >> .gitignore
echo "__pycache__/" >> .gitignore
echo "node_modules/" >> .gitignore
echo ".next/" >> .gitignore
```

## Step 5: Start Claude Code

```bash
# From the finance-platform directory on MacBook:
claude

# Your first message (copy from PROMPTS.md Session 1):
# "Read CLAUDE.md, BUILD_PLAN.md, and SPEC.md in full. 
#  We're starting from scratch. Build Phase 1..."
```

## Step 6: Deploy to NUC (After Phase 8)

```bash
# Option A: Push via git (recommended)
# On NUC:
git clone <your-repo> ~/finance-platform
cd ~/finance-platform
cp .env.example .env
nano .env  # fill in same values

# Start the stack:
docker compose up -d

# Option B: rsync from MacBook
rsync -avz --exclude '.git' --exclude 'node_modules' --exclude '.next' \
  ~/projects/finance-platform/ \
  user@nuc.tailnet-xyz.ts.net:~/finance-platform/

# On NUC after sync:
cd ~/finance-platform
docker compose up -d

# Run migrations on NUC:
docker compose exec backend alembic upgrade head

# Access from MacBook browser:
# http://hive.savannah-chimaera.ts.net
```

## Step 7: Link Your Accounts (Manual — Cannot Be Automated)

After the platform is running:

1. Navigate to `http://hive.savannah-chimaera.ts.net/connect` (or localhost:3000/connect during dev)
2. Click "Connect Account"
3. Complete Plaid Link for each account — you'll log into your actual bank
4. Do this for all 8 accounts:
   - Amex (for Amex Gold)
   - Chase (for Sapphire Preferred + Southwest Plus)
   - Bilt (for Bilt Blue)
   - Wells Fargo (for WF Autograph)
   - Capital One (for Venture X)
   - Your checking bank
   - Your savings bank

Note: One Plaid "Item" per institution. Chase will give you both cards in one login.

## Maintenance

```bash
# Check logs
docker compose logs -f backend
docker compose logs -f celery_worker

# Force a manual sync
docker compose exec celery_worker celery -A app.celery_app call tasks.ingestion.sync_all_accounts

# Run anomaly detection now
docker compose exec celery_worker celery -A app.celery_app call tasks.ml_tasks.run_anomaly_scan

# Update the platform after changes
docker compose pull
docker compose up -d --build
docker compose exec backend alembic upgrade head

# Backup the database
docker compose exec postgres pg_dump -U finance_user finance > backup_$(date +%Y%m%d).sql
```
