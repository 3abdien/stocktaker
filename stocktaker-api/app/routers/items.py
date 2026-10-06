from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from .. import services
from ..barcode_utils import decode_barcodes_from_bytes
from ..database import get_db
from ..deps import get_current_user, require_role, require_site_access, effective_site_filter
from ..models import Category, Item, Site, User, UserRole
from ..schemas import ItemCreate, ItemOut, StockActionRequest, AdjustRequest, TransactionOut

router = APIRouter(prefix="/items", tags=["items"])


@router.get("", response_model=list[ItemOut])
def list_items(
    site_id: Optional[int] = None,
    category_id: Optional[int] = None,
    barcode: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    effective_site = effective_site_filter(user, site_id)

    if barcode:
        item = services.find_item_by_barcode(db, barcode)
        if item is None:
            return []
        if not user.can_access_site(item.site_id):
            return []
        return [item]

    return services.list_items(db, site_id=effective_site, category_id=category_id)


@router.get("/{item_id}", response_model=ItemOut)
def get_item(item_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = db.get(Item, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found.")
    require_site_access(item.site_id, user)
    return item


@router.post("", response_model=ItemOut, status_code=201)
def create_item(
    body: ItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
):
    require_site_access(body.site_id, user)

    category = db.get(Category, body.category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found.")
    if db.get(Site, body.site_id) is None:
        raise HTTPException(status_code=404, detail="Site not found.")

    try:
        item = services.register_new_item(
            db, user, category, body.site_id, body.name,
            initial_quantity=body.initial_quantity, unit=body.unit, location=body.location,
            min_stock=body.min_stock, notes=body.notes, barcode=body.barcode,
        )
        db.commit()
        db.refresh(item)
        return item
    except services.ServiceError as e:
        db.rollback()
        raise HTTPException(status_code=e.status_code, detail=e.message)


def _get_owned_item(db: Session, item_id: int, user: User) -> Item:
    item = db.get(Item, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found.")
    require_site_access(item.site_id, user)
    return item


@router.post("/{item_id}/check-in", response_model=TransactionOut)
def check_in(
    item_id: int, body: StockActionRequest, db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = _get_owned_item(db, item_id, user)
    try:
        txn = services.check_in(db, user, item, body.quantity, body.note)
        db.commit()
        db.refresh(txn)
        return txn
    except services.ServiceError as e:
        db.rollback()
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/{item_id}/check-out", response_model=TransactionOut)
def check_out(
    item_id: int, body: StockActionRequest, db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = _get_owned_item(db, item_id, user)
    try:
        txn = services.check_out(db, user, item, body.quantity, body.note)
        db.commit()
        db.refresh(txn)
        return txn
    except services.ServiceError as e:
        db.rollback()
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/{item_id}/adjust", response_model=TransactionOut)
def adjust(
    item_id: int, body: AdjustRequest, db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
):
    item = _get_owned_item(db, item_id, user)
    try:
        txn = services.adjust_stock(db, user, item, body.new_quantity, body.note)
        db.commit()
        db.refresh(txn)
        return txn
    except services.ServiceError as e:
        db.rollback()
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/decode-photo")
async def decode_photo(
    file: UploadFile = File(...), _user: User = Depends(get_current_user)
):
    """Web-dashboard helper: upload a photo, get back any barcodes found in
    it. The mobile app doesn't need this - it decodes on-device."""
    content = await file.read()
    try:
        results = decode_barcodes_from_bytes(content)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read that image.")
    return [{"data": r.data, "symbology": r.symbology} for r in results]
