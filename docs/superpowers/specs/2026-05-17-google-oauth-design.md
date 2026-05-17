# Google OAuth Sign-In — Design Spec
**Date:** 2026-05-17
**Status:** Approved

## Problem

The admin account is secured by a username/password that can be forgotten, leading to loss of access to all linked financial data. Google sign-in ties authentication to a Google identity the user can never lose.

## Goal

Add "Sign in with Google" as an alternative login method alongside the existing username/password flow. No additional cost. No new services required beyond a free Google Cloud OAuth 2.0 credential.

---

## Data Model

**Migration:** `add_google_oauth_to_users`

Two new nullable columns on the `users` table:

| Column | Type | Constraint |
|---|---|---|
| `google_id` | `TEXT` | `UNIQUE`, nullable |
| `email` | `TEXT` | nullable |

No columns are removed. Existing username/password accounts continue to work unchanged.

---

## Account Linking Logic

On every Google sign-in callback, the backend runs this decision tree in order:

1. **`google_id` match** — find user where `google_id = <google_sub>` → sign in
2. **Email match** — find user where `email = <google_email>` → attach `google_id`, sign in
3. **No match** — create new user:
   - `google_id` = Google sub
   - `email` = Google email
   - `username` = derived from email local part (e.g. `zach` from `zach@gmail.com`), with collision suffix if taken
   - `password_hash` = empty string (Google-only account, can never be used for password login)
   - `role` = `admin` if no users exist yet, else `viewer`

This means the existing admin account is transparently linked on first Google sign-in if emails match.

---

## Backend

### New dependencies

- `authlib` — OAuth 2.0 client (handles PKCE, token exchange, Google JWKS verification)

### New environment variables (`.env`)

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://<your-domain>/api/auth/google/callback
```

### New endpoints — `app/api/auth_google.py`

**`GET /api/auth/google`**
- Generates a `state` parameter (random hex, stored in a short-lived `oauth_state` cookie)
- Redirects browser to Google's authorization URL with scopes `openid email profile`

**`GET /api/auth/google/callback`**
- Validates `state` cookie to prevent CSRF
- Exchanges `code` for tokens via Google's token endpoint
- Fetches user profile (`sub`, `email`, `name`) from Google's userinfo endpoint
- Runs account linking logic (find-or-create)
- Issues `hive_auth` JWT cookie (same as password login)
- Clears `oauth_state` cookie
- Redirects to `/dashboard`

### Modified files

- `app/main.py` — include `auth_google` router
- `app/config.py` — add `google_client_id`, `google_client_secret`, `google_redirect_uri` settings

---

## Frontend

### Login page (`/login`)

Add a "Continue with Google" button above the username/password form with a visual divider ("or"). Clicking it navigates to `/api/auth/google` (full page navigation, not `fetch`). No new pages needed — the backend callback redirects straight to `/dashboard`.

### Register page (`/register`)

Add the same "Continue with Google" button. Same behavior.

### No new frontend pages required.

---

## Google Cloud Setup (one-time, free)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a project
2. APIs & Services → OAuth consent screen → External → fill in app name
3. APIs & Services → Credentials → Create OAuth 2.0 Client ID → Web application
4. Add authorized redirect URI: `https://<your-domain>/api/auth/google/callback`
5. Copy Client ID and Client Secret into `.env`

---

## Security Notes

- `state` parameter prevents CSRF on the OAuth callback
- `google_id` is the stable identifier (not email, which can change)
- Email is stored only for the linking lookup — not used as a login credential
- Google-only accounts have an empty `password_hash` and cannot be used with password login
- All session handling is identical to existing: httpOnly cookie, 12-hour JWT expiry

---

## Out of Scope

- Unlinking Google from an account
- Forcing Google-only (password login stays available)
- Other OAuth providers (GitHub, Apple, etc.)
