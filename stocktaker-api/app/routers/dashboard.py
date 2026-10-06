from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import services
from ..database import get_db
from ..deps import get_current_user, effective_site_filter
from ..models import ReportStatus, User
from ..schemas import ItemOut

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/low-stock", response_model=list[ItemOut])
def low_stock(
    site_id: Optional[int] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    effective_site = effective_site_filter(user, site_id)
    return services.list_low_stock_items(db, site_id=effective_site)


@router.get("/summary")
def summary(
    site_id: Optional[int] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    effective_site = effective_site_filter(user, site_id)
    items = services.list_items(db, site_id=effective_site)
    low_stock_items = [i for i in items if i.is_low_stock]
    pending_reports = services.list_unidentified_reports(
        db, site_id=effective_site, status=ReportStatus.PENDING
    )
    return {
        "total_items": len(items),
        "low_stock_count": len(low_stock_items),
        "pending_reports_count": len(pending_reports),
    }
