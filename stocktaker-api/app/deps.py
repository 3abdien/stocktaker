"""FastAPI dependencies: DB session, current user, and role/site checks.

This is where authorization actually lives - every endpoint that touches
site-scoped data goes through `require_site_access` or `require_role`
rather than trusting the client.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from .database import get_db
from .models import User, UserRole
from .security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if token is None:
        raise credentials_error
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise credentials_error

    user = db.get(User, user_id)
    if user is None or not user.active:
        raise credentials_error
    return user


def require_role(*roles: UserRole):
    """Dependency factory: 403s unless the current user has one of `roles`."""

    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of these roles: {', '.join(r.value for r in roles)}.",
            )
        return user

    return checker


def require_site_access(site_id: int, user: User) -> None:
    """403s unless `user` may act on `site_id` (admins can access any site)."""
    if not user.can_access_site(site_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this site.",
        )


def effective_site_filter(user: User, requested_site_id: int | None) -> int | None:
    """Resolve which site_id a listing endpoint should filter by.

    Admins may pass any site_id (or None for "all sites"). Managers/workers
    are always pinned to their own site, regardless of what they ask for.
    """
    if user.is_admin:
        return requested_site_id
    return user.site_id
