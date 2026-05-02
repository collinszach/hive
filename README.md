# Hive — Personal Finance Intelligence Platform

A self-hosted personal finance platform that automatically pulls transactions from all your bank and credit card accounts, categorizes them with AI, tracks credit card points, monitors budgets, and answers questions about your money in plain English.

## What It Does

- **Automatic sync** — pulls transactions daily from every linked account via Plaid (no CSV imports)
- **AI categorization** — three-stage pipeline: regex rules → local Ollama LLM → Claude Haiku fallback
- **Credit card optimizer** — tells you which card earns the most points for any purchase
- **Budget tracking** — set monthly budgets by category, see live progress
- **Anomaly detection** — ML-based (IsolationForest) flagging of unusual transactions
- **Spending forecasts** — Prophet-based projections by category
- **AI chat** — ask natural language questions about your finances, powered by Claude Sonnet
- **Net worth tracking** — daily balance snapshots across all accounts including investments (SnapTrade)

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI + Uvicorn |
| Task queue | Celery + Redis |
| Database | PostgreSQL 16 |
| ORM | SQLAlchemy 2.0 (async) + Alembic |
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Bank data | Plaid Transactions Sync API |
| Investment data | SnapTrade API |
| AI categorization | Ollama (llama3.2) → Claude Haiku 4.5 |
| AI chat | Claude Sonnet 4.6 with prompt caching |
| Anomaly detection | scikit-learn IsolationForest |
| Forecasting | Prophet |
| Reverse proxy | Nginx |
| Containerization | Docker Compose |

## Architecture

```
Browser (Vercel) → Nginx → FastAPI backend → PostgreSQL
                                ↓
                         Celery workers (daily sync, ML tasks)
                                ↓
                    Plaid API / Ollama (local) / Claude API
```

The backend runs on a home server (NUC or any Linux machine). The frontend deploys to Vercel and proxies API calls back to your server via the `BACKEND_URL` environment variable.

## Getting Started

See [SETUP.md](SETUP.md) for the full step-by-step setup guide covering:
- NUC prerequisites (Docker, Ollama, Tailscale)
- API keys needed (Plaid, Anthropic, SnapTrade)
- Environment configuration
- Deployment and account linking

**Quick version:**

```bash
git clone https://github.com/collinszach/hive.git
cd hive
cp .env.example .env
# Fill in your API keys in .env
docker compose up -d
docker compose exec backend alembic upgrade head
```

## Environment Variables

Copy `.env.example` to `.env`. Required to start:

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | Database password (any strong string) |
| `PLAID_CLIENT_ID` | From [Plaid dashboard](https://dashboard.plaid.com) |
| `PLAID_SECRET` | From Plaid dashboard |
| `ANTHROPIC_API_KEY` | From [Anthropic console](https://console.anthropic.com) |
| `SECRET_KEY` | Random secret: `openssl rand -hex 32` |
| `FERNET_KEY` | Encryption key: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |

See `.env.example` for the full list including optional SnapTrade and Ollama configuration.

## Self-Hosting Notes

- Designed to run on a home server (Ubuntu NUC, Raspberry Pi, any Linux box)
- Remote access via [Tailscale](https://tailscale.com) — no ports exposed to the internet
- Ollama runs on the host machine (not in Docker) for GPU access
- All financial data stays on your own hardware

## License

MIT
