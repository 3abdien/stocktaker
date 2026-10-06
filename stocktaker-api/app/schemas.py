"""Pydantic request/response models."""

from __future__ import annotations

import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from .models import UserRole, TransactionType, ReportStatus


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------------------------
# Sites
# ---------------------------------------------------------------------------


class SiteCreate(BaseModel):
    name: str
    address: str = ""


class SiteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    address: str


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


class UserCreate(BaseModel):
    username: str
    password: str = Field(min_length=8)
    full_name: str = ""
    role: UserRole = UserRole.WORKER
    site_id: Optional[int] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    full_name: str
    role: UserRole
    site_id: Optional[int]
    active: bool


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------


class CategoryCreate(BaseModel):
    name: str
    code: Optional[str] = None
    description: str = ""


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    code: str
    description: str


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------


class ItemCreate(BaseModel):
    name: str
    category_id: int
    site_id: int
    barcode: Optional[str] = None  # omit to auto-generate
    initial_quantity: float = 0
    unit: str = "pcs"
    location: str = ""
    min_stock: float = 0
    notes: str = ""


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    barcode: str
    name: str
    category_id: int
    site_id: int
    quantity: float
    unit: str
    location: str
    min_stock: float
    notes: str
    is_low_stock: bool


class StockActionRequest(BaseModel):
    quantity: float = Field(gt=0)
    note: str = ""


class AdjustRequest(BaseModel):
    new_quantity: float = Field(ge=0)
    note: str = ""


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    item_id: int
    user_id: int
    type: TransactionType
    quantity_delta: float
    resulting_quantity: float
    note: str
    timestamp: datetime.datetime


# ---------------------------------------------------------------------------
# Unidentified reports
# ---------------------------------------------------------------------------


class UnidentifiedReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    barcode: str
    photo_path: str
    note: str
    site_id: int
    reported_by: int
    reported_at: datetime.datetime
    status: ReportStatus
    resolved_item_id: Optional[int]
    resolved_by: Optional[int]
    resolved_at: Optional[datetime.datetime]
    rejection_reason: Optional[str]


class ReportResolveRequest(BaseModel):
    name: str
    category_id: int
    initial_quantity: float = 0
    unit: str = "pcs"
    location: str = ""
    min_stock: float = 0


class ReportRejectRequest(BaseModel):
    reason: str
