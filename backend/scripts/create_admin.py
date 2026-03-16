"""
Create or update the admin user from environment variables.

Usage (run inside the backend container):
    docker compose exec backend python scripts/create_admin.py

Reads AUTH_USERNAME and AUTH_PASSWORD from environment.
Idempotent: safe to run multiple times. If the user already exists,
only the password is updated (useful for password rotation).
"""
import os
import sys

import bcrypt
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

# Allow running from the project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.config import settings
from app.models.user import User


def main() -> None:
    username = os.environ.get("AUTH_USERNAME", "").strip()
    password = os.environ.get("AUTH_PASSWORD", "").strip()

    if not username or not password:
        print("ERROR: AUTH_USERNAME and AUTH_PASSWORD must be set in environment.")
        sys.exit(1)

    if len(password) < 12:
        print("ERROR: AUTH_PASSWORD must be at least 12 characters.")
        sys.exit(1)

    engine = create_engine(settings.database_sync_url)
    with Session(engine) as db:
        existing = db.execute(select(User).where(User.username == username)).scalar_one_or_none()
        pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()

        if existing:
            existing.password_hash = pw_hash
            existing.is_active = True
            db.add(existing)
            db.commit()
            print(f"Updated password for existing user '{username}'.")
        else:
            user = User(username=username, password_hash=pw_hash)
            db.add(user)
            db.commit()
            print(f"Created admin user '{username}'.")


if __name__ == "__main__":
    main()
