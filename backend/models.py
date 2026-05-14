from datetime import datetime
from sqlalchemy import (
    Boolean, Column, Date, DateTime, ForeignKey,
    Integer, String, Text, event
)
from sqlalchemy.sql import func
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
    is_recurring = Column(Boolean, default=False, nullable=False, server_default="0")

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


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="admin", nullable=False)  # "super_admin" | "admin"
    is_active = Column(Boolean, default=True, nullable=False)
    created_by_id = Column(Integer, ForeignKey("admin_users.id"), nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("admin_users.id"), nullable=False, index=True)
    action = Column(String, nullable=False)  # e.g. "suspend_user", "delete_transaction"
    target_type = Column(String, nullable=True)  # "user", "transaction", "admin"
    target_id = Column(Integer, nullable=True)
    detail = Column(Text, nullable=True)  # JSON string with extra context
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    country = Column(String, nullable=True)
    currency = Column(String, default="USD", nullable=True)
    income_bracket = Column(String, nullable=True)  # "0-25k", "25k-50k", "50k-100k", "100k-200k", "200k+"
    financial_goal = Column(String, nullable=True)  # "save", "invest", "debt_free", "retire_early", "track"
    occupation = Column(String, nullable=True)
    is_suspended = Column(Boolean, default=False, nullable=False, server_default="0")
    suspended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("admin_users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class UserNotificationRead(Base):
    __tablename__ = "user_notification_reads"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    notification_id = Column(Integer, ForeignKey("notifications.id"), nullable=False)
    read_at = Column(DateTime(timezone=True), server_default=func.now())


class AuditEntry(Base):
    __tablename__ = "audit_entries"
    id = Column(Integer, primary_key=True, index=True)
    client_name = Column(String, nullable=False)
    company_name = Column(String, nullable=False)
    audit_date = Column(Date, nullable=False)
    duration_days = Column(Integer, nullable=False, default=1)
    notes = Column(Text, nullable=True)
    location = Column(String, nullable=True)
    status = Column(String, default="scheduled")  # scheduled, in_progress, completed, cancelled
    created_by_id = Column(Integer, ForeignKey("admin_users.id"), nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    assignments = relationship("AuditAssignment", back_populates="audit_entry", cascade="all, delete-orphan")
    expenses = relationship("AuditExpense", back_populates="audit_entry", cascade="all, delete-orphan")

class AuditAssignment(Base):
    __tablename__ = "audit_assignments"
    id = Column(Integer, primary_key=True, index=True)
    audit_id = Column(Integer, ForeignKey("audit_entries.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String, default="auditor")  # auditor, lead, reviewer
    assigned_at = Column(DateTime, default=func.now())
    audit_entry = relationship("AuditEntry", back_populates="assignments")
    user = relationship("User")

class AuditExpense(Base):
    __tablename__ = "audit_expenses"
    id = Column(Integer, primary_key=True, index=True)
    audit_id = Column(Integer, ForeignKey("audit_entries.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount_cents = Column(Integer, nullable=False)
    currency = Column(String, default="USD")
    description = Column(String, nullable=False)
    category = Column(String, default="other")  # travel, accommodation, meals, transportation, supplies, other
    expense_date = Column(Date, nullable=False)
    status = Column(String, default="pending")  # pending, approved, rejected
    review_note = Column(Text, nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("admin_users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    submitted_at = Column(DateTime, default=func.now())
    audit_entry = relationship("AuditEntry", back_populates="expenses")
    user = relationship("User", foreign_keys=[user_id])
    reviewer = relationship("AdminUser", foreign_keys=[reviewed_by_id])
