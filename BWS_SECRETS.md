# Bitwarden Secrets Manager — Required Secret Keys

All secrets are stored in BWS (Bitwarden Secrets Manager) and injected at
deploy time via `deploy.sh`. The `.env` file is ephemeral — generated during
deploy and shredded immediately after `docker compose up`.

## Setup

1. Install the BWS CLI:
   ```bash
   # Linux (NUC)
   curl -fsSLo bws.zip https://github.com/bitwarden/sdk/releases/latest/download/bws-x86_64-unknown-linux-gnu.zip
   unzip bws.zip && sudo mv bws /usr/local/bin/ && rm bws.zip

   # macOS (dev machine)
   brew install bitwarden/tools/bws
   ```

2. Create a machine account token in BWS dashboard → Access → Machine Accounts.
   Grant it read access to your Hive project.

3. Export the token before deploying:
   ```bash
   export BWS_ACCESS_TOKEN=<your-machine-account-token>
   ```

## Required Secret Keys

These key names must match exactly in BWS (case-sensitive):

### Database
| Key | Example Value |
|-----|--------------|
| `POSTGRES_DB` | `finance` |
| `POSTGRES_USER` | `admin` |
| `POSTGRES_PASSWORD` | *(strong password)* |

### Redis
| Key | Example Value |
|-----|--------------|
| `REDIS_PASSWORD` | *(strong password)* |

### Plaid
| Key | Example Value |
|-----|--------------|
| `PLAID_CLIENT_ID` | *(from dashboard.plaid.com → Developers → Keys)* |
| `PLAID_SECRET` | *(production secret)* |
| `PLAID_ENV` | `production` |
| `PLAID_REDIRECT_URI` | `http://<nuc-tailscale-hostname>/connect` |
| `PLAID_WEBHOOK_URL` | *(optional — leave blank if not using webhooks)* |

### Anthropic
| Key | Example Value |
|-----|--------------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |

### Ollama (runs on NUC host)
| Key | Example Value |
|-----|--------------|
| `OLLAMA_URL` | `http://host.docker.internal:11434` |
| `OLLAMA_MODEL` | `llama3.2` |

### App
| Key | Example Value |
|-----|--------------|
| `SECRET_KEY` | *(64-char hex: `openssl rand -hex 32`)* |
| `LOG_LEVEL` | `INFO` |

### Frontend
| Key | Example Value |
|-----|--------------|
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8005` |
| `NEXT_PUBLIC_EXTERNAL_API_URL` | *(optional — NUC Tailscale URL if needed)* |

### Optional
| Key | Example Value |
|-----|--------------|
| `SNAPTRADE_CLIENT_ID` | *(SnapTrade dashboard)* |
| `SNAPTRADE_CONSUMER_KEY` | *(SnapTrade dashboard)* |
| `SLACK_WEBHOOK_URL` | *(Slack app webhook — for budget alerts)* |
| `NTFY_URL` | *(ntfy.sh URL)* |
| `NTFY_TOPIC` | `finance-alerts` |

## Deploying

```bash
# Full deploy (first time or after code changes)
export BWS_ACCESS_TOKEN=<token>
./deploy.sh

# Force re-run Alembic migrations
./deploy.sh --migrate

# After rotating a secret in BWS dashboard
./rotate-secrets.sh

# Rotate only one service
./rotate-secrets.sh --service backend
```

## Verifying secrets are loaded

```bash
# List all secrets in your BWS project
bws secret list | jq '.[].key'

# Confirm a specific secret exists
bws secret list | jq -r '.[] | select(.key == "PLAID_CLIENT_ID") | .key'
```
