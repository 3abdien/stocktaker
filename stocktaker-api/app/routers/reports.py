from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import services
from ..database import get_db
from ..deps import get_current_user, require_role, require_site_access, effective_site_filter
from ..models import Category, ReportStatus, UnidentifiedReport, User, UserRole
from ..schemas import (
    UnidentifiedReportOut,
    ReportResolveRequest,
    ReportRejectRequest,
    ItemOut,
)
from ..storage import save_photo

router = APIRouter(prefix="/reports/unidentified", tags=["unidentified-reports"])

MAX_PHOTO_BYTES = 8 * 1024 * 1024  # 8 MB


@router.post("", response_model=UnidentifiedReportOut, status_code=201)
async def flag_unidentified_item(
    barcode: str = Form(...),
    note: str = Form(""),
    site_id: int = Form(...),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_site_access(site_id, user)

    content = await photo.read()
    if not content:
        raise HTTPException(status_code=400, detail="A photo is required.")
    if len(content) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=400, detail="Photo is too large (8MB max).")

    stored_name = save_photo(db, content, photo.filename or "photo.jpg")

    try:
        report = services.create_unidentified_report(db, user, site_id, barcode, stored_name, note)
        db.commit()
        db.refresh(report)
        return report
    except services.ServiceError as e:
        db.rollback()
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("", response_model=list[UnidentifiedReportOut])
def list_reports(
    status: Optional[ReportStatus] = None,
    site_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    effective_site = effective_site_filter(user, site_id)
    return services.list_unidentified_reports(db, site_id=effective_site, status=status)


@router.get("/mine", response_model=list[UnidentifiedReportOut])
def my_reports(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = (
        select(UnidentifiedReport)
        .where(UnidentifiedReport.reported_by == user.id)
        .order_by(UnidentifiedReport.reported_at.desc())
    )
    return list(db.execute(stmt).scalars())


def _get_report(db: Session, report_id: int, user: User) -> UnidentifiedReport:
    report = db.get(UnidentifiedReport, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found.")
    require_site_access(report.site_id, user)
    return report


@router.post("/{report_id}/resolve", response_model=ItemOut)
def resolve(
    report_id: int, body: ReportResolveRequest, db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
):
    report = _get_report(db, report_id, user)
    category = db.get(Category, body.category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found.")

    try:
        item = services.resolve_report(
            db, user, report, category, body.name,
            initial_quantity=body.initial_quantity, unit=body.unit,
            location=body.location, min_stock=body.min_stock,
        )
        db.commit()
        db.refresh(item)
        return item
    except services.ServiceError as e:
        db.rollback()
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/{report_id}/reject", response_model=UnidentifiedReportOut)
def reject(
    report_id: int, body: ReportRejectRequest, db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
):
    report = _get_report(db, report_id, user)
    try:
        services.reject_report(db, user, report, body.reason)
        db.commit()
        db.refresh(report)
        return report
    except services.ServiceError as e:
        db.rollback()
        raise HTTPException(status_code=e.status_code, detail=e.message)
