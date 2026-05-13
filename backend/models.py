from datetime import datetime
from sqlalchemy import (
    Boolean, Column, Date, DateTime, ForeignKey,
    Integer, String, Text, event
)
from sqlalchemy.orm import relationship
from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    password_hash = Column(String, nullable=True)
    google_id = Column(String, unique=True, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    budget_cents = Column(Integer, default=0, nullable=False)
    color = Column(String, default="#6366f1", nullable=False)
    is_income = Column(Boolean, default=False, nullable=False, server_default="0")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # NULL = global default
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    transactions = relationship("Transaction", back_populates="category")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, index=True)
    description = Column(Text, nullable=False)
    amount_cents = Column(Integer, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    is_income = Column(Boolean, nullable=False, default=False)
    is_anomaly = Column(Boolean, default=False, nullable=False)
    source = Column(String, default="manual", nullable=False)  # "manual" or "csv_import"
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    party_id = Column(Integer, ForeignKey("parties.id"), nullable=True, index=True)
    invoice_number = Column(String, nullable=True)
    tax_amount_cents = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    payment_method = Column(String, nullable=True)  # cash | card | transfer | check | other
    is_reconciled = Column(Boolean, default=False, nullable=False, server_default="0")
    receipt_path = Column(String, nullable=True)

    category = relationship("Category", back_populates="transactions")


@event.listens_for(Transaction, "before_insert")
def set_is_income_on_insert(mapper, connection, target):
    target.is_income = target.amount_cents > 0


@event.listens_for(Transaction, "before_update")
def set_is_income_on_update(mapper, connection, target):
    target.is_income = target.amount_cents > 0


class Party(Base):
    __tablename__ = "parties"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    party_type = Column(String, default="vendor")  # vendor | customer | both
    tax_id = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class SharedReport(Base):
    __tablename__ = "shared_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String, unique=True, nullable=False, index=True)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    recipient_email = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)
