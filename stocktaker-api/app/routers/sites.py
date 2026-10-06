from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_role
from ..models import Site, User, UserRole
from ..schemas import SiteCreate, SiteOut

router = APIRouter(prefix="/sites", tags=["sites"])


@router.get("", response_model=list[SiteOut])
def list_sites(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Everyone can see the list of sites (needed for pickers); it's not
    # sensitive, and a worker/manager already knows their own site's name.
    return list(db.execute(select(Site).order_by(Site.name)).scalars())


@router.post("", response_model=SiteOut, status_code=201)
def create_site(
    body: SiteCreate, db: Session = Depends(get_db), _admin: User = Depends(require_role(UserRole.ADMIN))
):
    if db.execute(select(Site).where(Site.name == body.name.strip())).scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Site '{body.name}' already exists.")
    site = Site(name=body.name.strip(), address=body.address.strip())
    db.add(site)
    db.commit()
    db.refresh(site)
    return site
