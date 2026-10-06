"""SQLAlchemy ORM models - matches the schema in the requirements spec."""

from __future__ import annotations

import datetime
import enum

from sqlalchemy import (
    String,
    Integer,
    Numeric,
    ForeignKey,
    DateTime,
    Boolean,
    LargeBinary,
    Enum as SAEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"      # company-wide
    MANAGER = "manager"  # one site's office staff
    WORKER = "worker"    # mobile app, warehouse floor


class TransactionType(str, enum.Enum):
    CHECK_IN = "check_in"
    CHECK_OUT = "check_out"
    ADJUSTMENT = "adjustment"
    CREATED = "created"


class ReportStatus(str, enum.Enum):
    PENDING = "pending"
    RESOLVED = "resolved"
    REJECTED = "rejected"


class Site(Base):
    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow
    )

    users: Mapped[list["User"]] = relationship(back_populates="site")
    items: Mapped[list["Item"]] = relationship(back_populates="site")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    full_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), nullable=False, default=UserRole.WORKER)
    # NULL for admins (company-wide). Required for manager/worker.
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id"), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow
    )

    site: Mapped["Site | None"] = relationship(back_populates="users")

    @property
    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN

    @property
    def is_manager(self) -> bool:
        return self.role == UserRole.MANAGER

    @property
    def is_worker(self) -> bool:
        return self.role == UserRole.WORKER

    def can_access_site(self, site_id: int) -> bool:
        """Admins can access every site; everyone else only their own."""
        return self.is_admin or self.site_id == site_id


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(8), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    items: Mapped[list["Item"]] = relationship(back_populates="category")


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    barcode: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    unit: Mapped[str] = mapped_column(String(32), nullable=False, default="pcs")
    location: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    min_stock: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    notes: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )

    category: Mapped["Category"] = relationship(back_populates="items")
    site: Mapped["Site"] = relationship(back_populates="items")
    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="item", order_by="Transaction.timestamp.desc()"
    )

    @property
    def is_low_stock(self) -> bool:
        return float(self.quantity) <= float(self.min_stock)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    type: Mapped[TransactionType] = mapped_column(SAEnum(TransactionType), nullable=False)
    quantity_delta: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    resulting_quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    note: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    timestamp: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, index=True
    )

    item: Mapped["Item"] = relationship(back_populates="transactions")
    user: Mapped["User"] = relationship()


class UnidentifiedReport(Base):
    __tablename__ = "unidentified_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    barcode: Mapped[str] = mapped_column(String(64), nullable=False)
    photo_path: Mapped[str] = mapped_column(String(500), nullable=False)
    note: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id"), nullable=False)
    reported_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    reported_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow
    )
    status: Mapped[ReportStatus] = mapped_column(
        SAEnum(ReportStatus), nullable=False, default=ReportStatus.PENDING
    )
    resolved_item_id: Mapped[int | None] = mapped_column(ForeignKey("items.id"), nullable=True)
    resolved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    resolved_at: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    site: Mapped["Site"] = relationship()
    reporter: Mapped["User"] = relationship(foreign_keys=[reported_by])
    resolved_item: Mapped["Item | None"] = relationship(foreign_keys=[resolved_item_id])
    resolver: Mapped["User | None"] = relationship(foreign_keys=[resolved_by])


class Photo(Base):
    """Flagged-item photo bytes, stored in the database rather than on disk
    so the app runs on hosts with no persistent filesystem (e.g. Render's
    free tier). `UnidentifiedReport.photo_path` holds the `name`."""

    __tablename__ = "photos"

    name: Mapped[str] = mapped_column(String(64), primary_key=True)
    content_type: Mapped[str] = mapped_column(String(64), nullable=False)
    content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    issued_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow
    )
    expires_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
