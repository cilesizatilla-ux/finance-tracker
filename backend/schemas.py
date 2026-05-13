from __future__ import annotations

from datetime import date, datetime
from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Generic API wrapper
# ---------------------------------------------------------------------------

class APIResponse(BaseModel, Generic[T]):
    data: Optional[T] = None
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Category schemas
# ---------------------------------------------------------------------------

class CategoryCreate(BaseModel):
    name: str
    budget_cents: int = 0
    color: str = "#6366f1"
    is_income: bool = False


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    budget_cents: Optional[int] = None
    color: Optional[str] = None
    is_income: Optional[bool] = None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    budget_cents: int
    color: str
    is_income: bool
    spending_cents: int = 0  # populated by the router at query time
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Transaction schemas
# ---------------------------------------------------------------------------

class TransactionCreate(BaseModel):
    date: date
    description: str
    amount_cents: int
    category_id: Optional[int] = None
    source: str = "manual"
    party_id: Optional[int] = None
    invoice_number: Optional[str] = None
    tax_amount_cents: Optional[int] = None
    notes: Optional[str] = None
    payment_method: Optional[str] = None
    is_reconciled: bool = False
    receipt_path: Optional[str] = None


class TransactionUpdate(BaseModel):
    date: Optional[date] = None
    description: Optional[str] = None
    amount_cents: Optional[int] = None
    category_id: Optional[int] = None
    is_anomaly: Optional[bool] = None
    source: Optional[str] = None
    party_id: Optional[int] = None
    invoice_number: Optional[str] = None
    tax_amount_cents: Optional[int] = None
    notes: Optional[str] = None
    payment_method: Optional[str] = None
    is_reconciled: Optional[bool] = None
    receipt_path: Optional[str] = None


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: date
    description: str
    amount_cents: int
    category_id: Optional[int]
    category_name: Optional[str] = None
    category_color: Optional[str] = None
    is_income: bool
    is_anomaly: bool
    source: str
    deleted_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    party_id: Optional[int] = None
    party_name: Optional[str] = None
    invoice_number: Optional[str] = None
    tax_amount_cents: Optional[int] = None
    notes: Optional[str] = None
    payment_method: Optional[str] = None
    is_reconciled: bool = False
    receipt_path: Optional[str] = None


# ---------------------------------------------------------------------------
# Import result
# ---------------------------------------------------------------------------

class ImportResult(BaseModel):
    imported: int
    skipped: int
    errors: int
    transactions: List[TransactionOut]


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

class CashFlowItem(BaseModel):
    month: int
    year: int
    income_cents: int
    expense_cents: int


class BudgetStatus(BaseModel):
    category_id: int
    name: str
    budget_cents: int
    spent_cents: int
    color: str


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    email: str
    password: str
    name: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class GoogleAuth(BaseModel):
    credential: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: Optional[str]
    avatar_url: Optional[str]
    created_at: datetime


# ---------------------------------------------------------------------------
# Party schemas
# ---------------------------------------------------------------------------

class PartyCreate(BaseModel):
    name: str
    party_type: str = "vendor"
    tax_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class PartyUpdate(BaseModel):
    name: Optional[str] = None
    party_type: Optional[str] = None
    tax_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class PartyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    party_type: str
    tax_id: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Shared report schemas
# ---------------------------------------------------------------------------

class ShareCreate(BaseModel):
    month: int
    year: int
    recipient_email: Optional[str] = None


class ShareOut(BaseModel):
    token: str
    share_url: str
    month: int
    year: int
    recipient_email: Optional[str]
    email_sent: bool


class ShareListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    token: str
    month: int
    year: int
    recipient_email: Optional[str]
    created_at: datetime
