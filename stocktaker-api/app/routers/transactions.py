from __future__ import annotations

import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import services
from ..database import get_db
from ..deps import get_current_user, effective_site_filter
from ..models import User
from ..schemas import TransactionOut

router = APIRouter(tags=["transactions"])


@router.get("/transactions", response_model=list[TransactionOut])
def list_transactions(
    item_id: Optional[int] = None,
    site_id: Optional[int] = None,
    limit: int = 500,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    effective_site = effective_site_filter(user, site_id)
    return services.list_transactions(db, item_id=item_id, site_id=effective_site, limit=limit)


@router.get("/export/stock.csv")
def export_stock_csv(
    site_id: Optional[int] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    effective_site = effective_site_filter(user, site_id)
    items = services.list_items(db, site_id=effective_site)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Barcode", "Name", "Category", "Site", "Quantity", "Unit", "Min Stock", "Low Stock?", "Location"])
    for item in items:
        writer.writerow([
            item.barcode, item.name, item.category.name, item.site.name,
            item.quantity, item.unit, item.min_stock,
            "YES" if item.is_low_stock else "", item.location,
        ])
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=stock.csv"},
    )


@router.get("/export/transactions.csv")
def export_transactions_csv(
    site_id: Optional[int] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    effective_site = effective_site_filter(user, site_id)
    txns = services.list_transactions(db, site_id=effective_site, limit=100000)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Timestamp", "Item", "Barcode", "User", "Type", "Change", "Resulting Qty", "Note"])
    for t in txns:
        writer.writerow([
            t.timestamp.isoformat(sep=" ", timespec="seconds"), t.item.name, t.item.barcode,
            t.user.username, t.type.value, t.quantity_delta, t.resulting_quantity, t.note,
        ])
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions.csv"},
    )
