from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_site_access
from ..models import UnidentifiedReport, User
from ..storage import load_photo

router = APIRouter(prefix="/photos", tags=["photos"])


@router.get("/{stored_name}")
def get_photo(stored_name: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    report = db.execute(
        select(UnidentifiedReport).where(UnidentifiedReport.photo_path == stored_name)
    ).scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=404, detail="Photo not found.")
    require_site_access(report.site_id, user)

    photo = load_photo(db, stored_name)
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found.")
    return Response(
        content=photo.content,
        media_type=photo.content_type,
        # Private: these are behind auth, so no shared/proxy caching.
        headers={"Cache-Control": "private, max-age=86400"},
    )
