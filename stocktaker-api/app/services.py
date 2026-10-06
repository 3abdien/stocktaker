"""Business logic shared by the API routers - kept separate from FastAPI so
it's directly unit-testable and so every rule lives in exactly one place.
"""

from __future__ import annotations

import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import (
    Category,
    Item,
    Transaction,
    TransactionType,
    UnidentifiedReport,
    ReportStatus,
    User,
    UserRole,
)
from .barcode_utils import generate_barcode_value
from .config import settings
from .security import hash_password, verify_password


class ServiceError(Exception):
    """User-facing validation problem - routers turn this into an HTTP 400/404/409."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


# ---------------------------------------------------------------------------
# Auth / users
# ---------------------------------------------------------------------------


def authenticate(db: Session, username: str, password: str) -> User:
    user = db.execute(select(User).where(User.username == username.strip())).scalar_one_or_none()
    if user is None or not verify_password(password, user.password_hash):
        raise ServiceError("Invalid username or password.", status_code=401)
    if not user.active:
        raise ServiceError("This account has been deactivated.", status_code=401)
    return user


def create_user(
    db: Session, username: str, password: str, full_name: str = "",
    role: UserRole = UserRole.WORKER, site_id: Optional[int] = None,
) -> User:
    username = username.strip()
    if not username or not password:
        raise ServiceError("Username and password are required.")
    if role != UserRole.ADMIN and site_id is None:
        raise ServiceError("Managers and workers must be assigned a site.")

    if db.execute(select(User).where(User.username == username)).scalar_one_or_none():
        raise ServiceError(f"Username '{username}' is already taken.", status_code=409)

    user = User(
        username=username,
        password_hash=hash_password(password),
        full_name=full_name.strip(),
        role=role,
        site_id=site_id,
        active=True,
    )
    db.add(user)
    db.flush()
    return user


def ensure_default_admin(db: Session) -> None:
    exists = db.execute(select(User).limit(1)).scalar_one_or_none()
    if exists is None:
        create_user(db, "admin", settings.initial_admin_password, "Administrator", UserRole.ADMIN, site_id=None)


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------


def list_categories(db: Session) -> list[Category]:
    return list(db.execute(select(Category).order_by(Category.name)).scalars())


def create_category(db: Session, name: str, code: Optional[str] = None, description: str = "") -> Category:
    name = name.strip()
    if not name:
        raise ServiceError("Category name is required.")

    if db.execute(select(Category).where(Category.name == name)).scalar_one_or_none():
        raise ServiceError(f"Category '{name}' already exists.", status_code=409)

    if code:
        code = code.strip().upper()
    else:
        letters = "".join(ch for ch in name.upper() if ch.isalnum())
        code = letters[:3] or "CAT"

    base_code, n = code, 2
    while db.execute(select(Category).where(Category.code == code)).scalar_one_or_none():
        code = f"{base_code[:6]}{n}"
        n += 1

    category = Category(name=name, code=code, description=description.strip())
    db.add(category)
    db.flush()
    return category


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------


def find_item_by_barcode(db: Session, barcode: str) -> Optional[Item]:
    return db.execute(select(Item).where(Item.barcode == barcode.strip())).scalar_one_or_none()


def list_items(db: Session, site_id: Optional[int] = None, category_id: Optional[int] = None) -> list[Item]:
    stmt = select(Item).order_by(Item.name)
    if site_id is not None:
        stmt = stmt.where(Item.site_id == site_id)
    if category_id is not None:
        stmt = stmt.where(Item.category_id == category_id)
    return list(db.execute(stmt).scalars())


def list_low_stock_items(db: Session, site_id: Optional[int] = None) -> list[Item]:
    return [i for i in list_items(db, site_id=site_id) if i.is_low_stock]


def register_new_item(
    db: Session, user: User, category: Category, site_id: int, name: str,
    initial_quantity: float = 0, unit: str = "pcs", location: str = "",
    min_stock: float = 0, notes: str = "", barcode: Optional[str] = None,
) -> Item:
    name = name.strip()
    if not name:
        raise ServiceError("Item name is required.")
    if initial_quantity < 0:
        raise ServiceError("Initial quantity cannot be negative.")

    if barcode:
        barcode = barcode.strip()
        if find_item_by_barcode(db, barcode):
            raise ServiceError(f"Barcode '{barcode}' is already registered to another item.", status_code=409)
    else:
        def is_unique(candidate: str) -> bool:
            return find_item_by_barcode(db, candidate) is None
        barcode = generate_barcode_value(category.code, is_unique)

    item = Item(
        barcode=barcode, name=name, category_id=category.id, site_id=site_id,
        quantity=initial_quantity, unit=unit.strip() or "pcs", location=location.strip(),
        min_stock=min_stock, notes=notes.strip(),
    )
    db.add(item)
    db.flush()

    db.add(Transaction(
        item_id=item.id, user_id=user.id, type=TransactionType.CREATED,
        quantity_delta=initial_quantity, resulting_quantity=initial_quantity,
        note="Item registered in inventory.",
    ))
    db.flush()
    return item


def check_in(db: Session, user: User, item: Item, quantity: float, note: str = "") -> Transaction:
    if quantity <= 0:
        raise ServiceError("Check-in quantity must be greater than zero.")
    item.quantity = float(item.quantity) + quantity
    txn = Transaction(
        item_id=item.id, user_id=user.id, type=TransactionType.CHECK_IN,
        quantity_delta=quantity, resulting_quantity=item.quantity, note=note.strip(),
    )
    db.add(txn)
    db.flush()
    return txn


def check_out(db: Session, user: User, item: Item, quantity: float, note: str = "") -> Transaction:
    if quantity <= 0:
        raise ServiceError("Check-out quantity must be greater than zero.")
    if quantity > float(item.quantity):
        raise ServiceError(f"Only {float(item.quantity):g} {item.unit} of '{item.name}' left in stock.")
    item.quantity = float(item.quantity) - quantity
    txn = Transaction(
        item_id=item.id, user_id=user.id, type=TransactionType.CHECK_OUT,
        quantity_delta=-quantity, resulting_quantity=item.quantity, note=note.strip(),
    )
    db.add(txn)
    db.flush()
    return txn


def adjust_stock(db: Session, user: User, item: Item, new_quantity: float, note: str = "") -> Transaction:
    if new_quantity < 0:
        raise ServiceError("Quantity cannot be negative.")
    delta = new_quantity - float(item.quantity)
    item.quantity = new_quantity
    txn = Transaction(
        item_id=item.id, user_id=user.id, type=TransactionType.ADJUSTMENT,
        quantity_delta=delta, resulting_quantity=item.quantity,
        note=note.strip() or "Manual stock adjustment.",
    )
    db.add(txn)
    db.flush()
    return txn


def list_transactions(
    db: Session, item_id: Optional[int] = None, site_id: Optional[int] = None, limit: int = 500,
) -> list[Transaction]:
    stmt = select(Transaction).join(Item).order_by(Transaction.timestamp.desc()).limit(limit)
    if item_id is not None:
        stmt = stmt.where(Transaction.item_id == item_id)
    if site_id is not None:
        stmt = stmt.where(Item.site_id == site_id)
    return list(db.execute(stmt).scalars())


# ---------------------------------------------------------------------------
# Unidentified item reports
# ---------------------------------------------------------------------------


def create_unidentified_report(
    db: Session, reporter: User, site_id: int, barcode: str, photo_path: str, note: str = "",
) -> UnidentifiedReport:
    if not barcode.strip():
        raise ServiceError("Barcode is required.")
    report = UnidentifiedReport(
        barcode=barcode.strip(), photo_path=photo_path, note=note.strip(),
        site_id=site_id, reported_by=reporter.id,
    )
    db.add(report)
    db.flush()
    return report


def list_unidentified_reports(
    db: Session, site_id: Optional[int] = None, status: Optional[ReportStatus] = None,
) -> list[UnidentifiedReport]:
    stmt = select(UnidentifiedReport).order_by(UnidentifiedReport.reported_at.desc())
    if site_id is not None:
        stmt = stmt.where(UnidentifiedReport.site_id == site_id)
    if status is not None:
        stmt = stmt.where(UnidentifiedReport.status == status)
    return list(db.execute(stmt).scalars())


def resolve_report(
    db: Session, resolver: User, report: UnidentifiedReport, category: Category,
    name: str, initial_quantity: float = 0, unit: str = "pcs", location: str = "",
    min_stock: float = 0,
) -> Item:
    if report.status != ReportStatus.PENDING:
        raise ServiceError(f"This report is already {report.status.value}.", status_code=409)

    item = register_new_item(
        db, resolver, category, report.site_id, name,
        initial_quantity=initial_quantity, unit=unit, location=location,
        min_stock=min_stock, notes=f"Registered from flagged report #{report.id}.",
        barcode=report.barcode,
    )
    report.status = ReportStatus.RESOLVED
    report.resolved_item_id = item.id
    report.resolved_by = resolver.id
    report.resolved_at = datetime.datetime.utcnow()
    db.flush()
    return item


def reject_report(db: Session, resolver: User, report: UnidentifiedReport, reason: str) -> UnidentifiedReport:
    if report.status != ReportStatus.PENDING:
        raise ServiceError(f"This report is already {report.status.value}.", status_code=409)
    if not reason.strip():
        raise ServiceError("A reason is required to reject a report.")

    report.status = ReportStatus.REJECTED
    report.resolved_by = resolver.id
    report.resolved_at = datetime.datetime.utcnow()
    report.rejection_reason = reason.strip()
    db.flush()
    return report
