from __future__ import annotations

import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import services, security
from ..database import get_db
from ..deps import get_current_user
from ..models import RefreshToken, User
from ..schemas import LoginRequest, RefreshRequest, TokenPair

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_token_pair(db: Session, user: User) -> TokenPair:
    access = security.create_access_token(user.id, user.role.value)

    refresh_value = security.new_refresh_token_value()
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=security.hash_token(refresh_value),
        expires_at=security.refresh_token_expiry(),
    ))
    db.commit()

    return TokenPair(access_token=access, refresh_token=refresh_value)


@router.post("/login", response_model=TokenPair)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    try:
        user = services.authenticate(db, body.username, body.password)
    except services.ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    return _issue_token_pair(db, user)


@router.post("/refresh", response_model=TokenPair)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    token_hash = security.hash_token(body.refresh_token)
    record = db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    ).scalar_one_or_none()

    invalid = HTTPException(status_code=401, detail="Invalid or expired refresh token.")
    if record is None or record.revoked:
        raise invalid

    if record.expires_at < datetime.datetime.utcnow():
        raise invalid

    user = db.get(User, record.user_id)
    if user is None or not user.active:
        raise invalid

    # Rotate: the presented refresh token can never be used again.
    record.revoked = True
    db.flush()

    return _issue_token_pair(db, user)


@router.post("/logout", status_code=204)
def logout(body: RefreshRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    token_hash = security.hash_token(body.refresh_token)
    record = db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash, RefreshToken.user_id == user.id
        )
    ).scalar_one_or_none()
    if record is not None:
        record.revoked = True
        db.commit()
    return None
