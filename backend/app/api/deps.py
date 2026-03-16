"""FastAPI dependencies shared across API routers."""
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

_bearer = HTTPBearer(auto_error=False)


def verify_auth(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
) -> None:
    """Verify the internal API token sent by the Next.js proxy.

    All API routes use this dependency. Plaid webhooks and /api/health are exempt
    because they are called by external systems that cannot carry this token.

    The token is set via INTERNAL_API_TOKEN env var and never exposed to the browser.
    """
    if not settings.internal_api_token:
        # Token not configured — deny all requests to avoid accidentally open API
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="INTERNAL_API_TOKEN is not configured on the server.",
        )

    if credentials is None or credentials.credentials != settings.internal_api_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
