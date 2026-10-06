from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import services
from ..database import get_db
from ..deps import get_current_user, require_role
from ..models import User, UserRole
from ..schemas import CategoryCreate, CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return services.list_categories(db)


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(
    body: CategoryCreate,
    db: Session = Depends(get_db),
    _staff: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
):
    try:
        category = services.create_category(db, body.name, body.code, body.description)
        db.commit()
        db.refresh(category)
        return category
    except services.ServiceError as e:
        db.rollback()
        raise HTTPException(status_code=e.status_code, detail=e.message)
