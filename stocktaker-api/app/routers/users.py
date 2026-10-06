from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import services
from ..database import get_db
from ..deps import get_current_user, require_role
from ..models import User, UserRole
from ..schemas import UserCreate, UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db), _admin: User = Depends(require_role(UserRole.ADMIN))
):
    return list(db.execute(select(User).order_by(User.username)).scalars())


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    body: UserCreate, db: Session = Depends(get_db), _admin: User = Depends(require_role(UserRole.ADMIN))
):
    try:
        user = services.create_user(
            db, body.username, body.password, body.full_name, body.role, body.site_id
        )
        db.commit()
        db.refresh(user)
        return user
    except services.ServiceError as e:
        db.rollback()
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.patch("/{user_id}/active", response_model=UserOut)
def set_active(
    user_id: int, active: bool, db: Session = Depends(get_db),
    admin: User = Depends(require_role(UserRole.ADMIN)),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="You can't deactivate your own account.")
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found.")
    target.active = active
    db.commit()
    db.refresh(target)
    return target
