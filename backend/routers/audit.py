from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from backend.database import get_db
from backend.dependencies import get_current_user
from backend.admin_auth import get_current_admin
from backend.models import AuditEntry, AuditAssignment, AuditExpense, User
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime, timedelta
import calendar as cal_mod

audit_router = APIRouter(prefix="/audit", tags=["audit"])
admin_audit_router = APIRouter(prefix="/admin/audit", tags=["admin-audit"])


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class AuditEntryCreate(BaseModel):
    client_name: str
    company_name: str
    factory_name: Optional[str] = None
    audit_date: date
    duration_days: float = 1.0
    notes: Optional[str] = None
    location: Optional[str] = None
    status: str = "scheduled"

class AuditEntryUpdate(BaseModel):
    client_name: Optional[str] = None
    company_name: Optional[str] = None
    factory_name: Optional[str] = None
    audit_date: Optional[date] = None
    duration_days: Optional[float] = None
    notes: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None

class AssignPayload(BaseModel):
    user_id: Optional[int] = None
    auditor_name: Optional[str] = None
    auditor_email: Optional[str] = None
    role: str = "auditor"

class NotifyPayload(BaseModel):
    assignment_ids: Optional[List[int]] = None  # None = notify all

class ExpenseCreate(BaseModel):
    amount_cents: int
    currency: str = "USD"
    description: str
    category: str = "other"
    expense_date: date

class ExpenseUpdate(BaseModel):
    amount_cents: Optional[int] = None
    currency: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    expense_date: Optional[date] = None

class ExpenseReview(BaseModel):
    status: str  # "approved" or "rejected"
    review_note: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ser_entry(e: AuditEntry) -> dict:
    return {
        "id": e.id,
        "client_name": e.client_name,
        "company_name": e.company_name,
        "factory_name": getattr(e, "factory_name", None),
        "audit_date": e.audit_date.isoformat(),
        "duration_days": e.duration_days,
        "notes": e.notes,
        "location": e.location,
        "status": e.status,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "assignments": [
            {
                "id": a.id,
                "user_id": a.user_id,
                "role": a.role,
                "user_name": a.user.name if a.user else getattr(a, "auditor_name", None),
                "user_email": a.user.email if a.user else getattr(a, "auditor_email", None),
                "auditor_name": getattr(a, "auditor_name", None),
                "auditor_email": getattr(a, "auditor_email", None),
                "notify_sent": getattr(a, "notify_sent", False),
                "approval_requested": getattr(a, "approval_requested", False),
            }
            for a in (e.assignments or [])
        ],
    }

def _ser_expense(ex: AuditExpense) -> dict:
    return {
        "id": ex.id,
        "audit_id": ex.audit_id,
        "user_id": ex.user_id,
        "user_name": ex.user.name if ex.user else None,
        "user_email": ex.user.email if ex.user else None,
        "amount_cents": ex.amount_cents,
        "currency": ex.currency,
        "description": ex.description,
        "category": ex.category,
        "expense_date": ex.expense_date.isoformat(),
        "status": ex.status,
        "review_note": ex.review_note,
        "reviewed_at": ex.reviewed_at.isoformat() if ex.reviewed_at else None,
        "submitted_at": ex.submitted_at.isoformat() if ex.submitted_at else None,
        "audit_client": ex.audit_entry.client_name if ex.audit_entry else None,
        "audit_company": ex.audit_entry.company_name if ex.audit_entry else None,
    }

def _build_ical(entries: list) -> str:
    now_str = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//FinanceTracker//Audit Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Audit Schedule",
    ]
    for e in entries:
        start = e.audit_date
        end = start + timedelta(days=e.duration_days)
        lines += [
            "BEGIN:VEVENT",
            f"UID:audit-{e.id}@financetracker.app",
            f"DTSTAMP:{now_str}",
            f"DTSTART;VALUE=DATE:{start.strftime('%Y%m%d')}",
            f"DTEND;VALUE=DATE:{end.strftime('%Y%m%d')}",
            f"SUMMARY:Audit: {e.client_name} - {e.company_name}",
            "DESCRIPTION:" + (e.notes or "").replace("\n", "\\n"),
            f"LOCATION:{e.location or ''}",
            "STATUS:CONFIRMED",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)


def _month_filter(query, year: Optional[int], month: Optional[int]):
    """Filter entries that overlap with the given year/month."""
    if year and month:
        month_start = date(year, month, 1)
        last_day = cal_mod.monthrange(year, month)[1]
        month_end = date(year, month, last_day)
        # entry overlaps month if: audit_date <= month_end AND (audit_date + duration_days - 1) >= month_start
        # Simplified: keep entries whose start is within ±60 days of month
        from sqlalchemy import and_
        query = query.filter(
            and_(
                AuditEntry.audit_date <= month_end,
                AuditEntry.audit_date >= date(year, month, 1) - timedelta(days=31)
            )
        )
    return query


# ── USER ENDPOINTS ────────────────────────────────────────────────────────────

@audit_router.get("/entries")
def list_my_audit_entries(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = (
        db.query(AuditEntry)
        .join(AuditAssignment, AuditAssignment.audit_id == AuditEntry.id)
        .filter(AuditAssignment.user_id == current_user.id)
        .options(joinedload(AuditEntry.assignments).joinedload(AuditAssignment.user))
    )
    q = _month_filter(q, year, month)
    return [_ser_entry(e) for e in q.order_by(AuditEntry.audit_date).all()]


@audit_router.get("/entries/{entry_id}")
def get_audit_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    e = (
        db.query(AuditEntry)
        .options(joinedload(AuditEntry.assignments).joinedload(AuditAssignment.user))
        .filter(AuditEntry.id == entry_id)
        .first()
    )
    if not e:
        raise HTTPException(status_code=404, detail="Audit entry not found")
    assigned_ids = {a.user_id for a in e.assignments}
    if current_user.id not in assigned_ids:
        raise HTTPException(status_code=403, detail="Not assigned to this audit")
    return _ser_entry(e)


@audit_router.get("/entries/{entry_id}/ical")
def download_entry_ical(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    e = (
        db.query(AuditEntry)
        .options(joinedload(AuditEntry.assignments))
        .filter(AuditEntry.id == entry_id)
        .first()
    )
    if not e:
        raise HTTPException(status_code=404, detail="Not found")
    assigned_ids = {a.user_id for a in e.assignments}
    if current_user.id not in assigned_ids:
        raise HTTPException(status_code=403, detail="Not assigned to this audit")
    content = _build_ical([e])
    return Response(
        content=content,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="audit-{entry_id}.ics"'},
    )


@audit_router.get("/calendar.ics")
def download_full_calendar(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    entries = (
        db.query(AuditEntry)
        .join(AuditAssignment, AuditAssignment.audit_id == AuditEntry.id)
        .filter(AuditAssignment.user_id == current_user.id)
        .order_by(AuditEntry.audit_date)
        .all()
    )
    content = _build_ical(entries)
    return Response(
        content=content,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="audit-calendar.ics"'},
    )


@audit_router.get("/my-expenses")
def list_my_expenses(
    audit_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = (
        db.query(AuditExpense)
        .options(
            joinedload(AuditExpense.user),
            joinedload(AuditExpense.audit_entry),
        )
        .filter(AuditExpense.user_id == current_user.id)
    )
    if audit_id:
        q = q.filter(AuditExpense.audit_id == audit_id)
    if status:
        q = q.filter(AuditExpense.status == status)
    return [_ser_expense(ex) for ex in q.order_by(desc(AuditExpense.submitted_at)).all()]


@audit_router.post("/entries/{entry_id}/expenses")
def submit_expense(
    entry_id: int,
    payload: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    e = db.query(AuditEntry).options(joinedload(AuditEntry.assignments)).filter(AuditEntry.id == entry_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Audit entry not found")
    if current_user.id not in {a.user_id for a in e.assignments}:
        raise HTTPException(status_code=403, detail="Not assigned to this audit")
    expense = AuditExpense(
        audit_id=entry_id,
        user_id=current_user.id,
        amount_cents=payload.amount_cents,
        currency=payload.currency,
        description=payload.description,
        category=payload.category,
        expense_date=payload.expense_date,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    # reload with relationships
    expense = db.query(AuditExpense).options(joinedload(AuditExpense.user), joinedload(AuditExpense.audit_entry)).filter(AuditExpense.id == expense.id).first()
    return _ser_expense(expense)


@audit_router.patch("/expenses/{expense_id}")
def update_expense(
    expense_id: int,
    payload: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    ex = db.query(AuditExpense).filter(AuditExpense.id == expense_id).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Expense not found")
    if ex.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your expense")
    if ex.status != "pending":
        raise HTTPException(status_code=400, detail="Can only edit pending expenses")
    for field, val in payload.dict(exclude_unset=True).items():
        setattr(ex, field, val)
    db.commit()
    db.refresh(ex)
    ex = db.query(AuditExpense).options(joinedload(AuditExpense.user), joinedload(AuditExpense.audit_entry)).filter(AuditExpense.id == expense_id).first()
    return _ser_expense(ex)


@audit_router.delete("/expenses/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    ex = db.query(AuditExpense).filter(AuditExpense.id == expense_id).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Not found")
    if ex.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your expense")
    if ex.status != "pending":
        raise HTTPException(status_code=400, detail="Cannot delete non-pending expense")
    db.delete(ex)
    db.commit()
    return {"ok": True}


# ── ADMIN ENDPOINTS ───────────────────────────────────────────────────────────

@admin_audit_router.get("/entries")
def admin_list_entries(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    q = db.query(AuditEntry).options(
        joinedload(AuditEntry.assignments).joinedload(AuditAssignment.user)
    )
    q = _month_filter(q, year, month)
    return [_ser_entry(e) for e in q.order_by(AuditEntry.audit_date).all()]


@admin_audit_router.post("/entries")
def admin_create_entry(
    payload: AuditEntryCreate,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    e = AuditEntry(**payload.dict(), created_by_id=admin.id)
    db.add(e)
    db.commit()
    db.refresh(e)
    e = db.query(AuditEntry).options(joinedload(AuditEntry.assignments).joinedload(AuditAssignment.user)).filter(AuditEntry.id == e.id).first()
    return _ser_entry(e)


@admin_audit_router.put("/entries/{entry_id}")
def admin_update_entry(
    entry_id: int,
    payload: AuditEntryUpdate,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    e = db.query(AuditEntry).filter(AuditEntry.id == entry_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Not found")
    for field, val in payload.dict(exclude_unset=True).items():
        setattr(e, field, val)
    db.commit()
    e = db.query(AuditEntry).options(joinedload(AuditEntry.assignments).joinedload(AuditAssignment.user)).filter(AuditEntry.id == entry_id).first()
    return _ser_entry(e)


@admin_audit_router.delete("/entries/{entry_id}")
def admin_delete_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    e = db.query(AuditEntry).filter(AuditEntry.id == entry_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(e)
    db.commit()
    return {"ok": True}


@admin_audit_router.post("/entries/{entry_id}/assign")
def admin_assign_auditor(
    entry_id: int,
    payload: AssignPayload,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    e = db.query(AuditEntry).filter(AuditEntry.id == entry_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Audit not found")

    if payload.user_id is not None:
        # Registered user assignment
        user = db.query(User).filter(User.id == payload.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        existing = db.query(AuditAssignment).filter(
            AuditAssignment.audit_id == entry_id,
            AuditAssignment.user_id == payload.user_id,
        ).first()
        if existing:
            existing.role = payload.role
            db.commit()
            return {"ok": True, "updated": True}
        a = AuditAssignment(audit_id=entry_id, user_id=payload.user_id, role=payload.role)
    else:
        # External auditor (by name + email)
        if not payload.auditor_name:
            raise HTTPException(status_code=400, detail="auditor_name required for external auditors")
        a = AuditAssignment(
            audit_id=entry_id,
            user_id=None,
            role=payload.role,
            auditor_name=payload.auditor_name,
            auditor_email=payload.auditor_email,
        )

    db.add(a)
    db.commit()
    db.refresh(a)
    return {"ok": True, "updated": False, "assignment_id": a.id}


@admin_audit_router.delete("/entries/{entry_id}/assign/{user_id}")
def admin_unassign_auditor(
    entry_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    a = db.query(AuditAssignment).filter(
        AuditAssignment.audit_id == entry_id,
        AuditAssignment.user_id == user_id,
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(a)
    db.commit()
    return {"ok": True}


@admin_audit_router.delete("/entries/{entry_id}/assignments/{assignment_id}")
def admin_unassign_by_id(
    entry_id: int,
    assignment_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    a = db.query(AuditAssignment).filter(
        AuditAssignment.id == assignment_id,
        AuditAssignment.audit_id == entry_id,
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(a)
    db.commit()
    return {"ok": True}


@admin_audit_router.post("/entries/{entry_id}/notify")
def admin_notify_auditors(
    entry_id: int,
    payload: NotifyPayload,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    e = db.query(AuditEntry).filter(AuditEntry.id == entry_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Audit not found")

    q = db.query(AuditAssignment).filter(AuditAssignment.audit_id == entry_id)
    if payload.assignment_ids:
        q = q.filter(AuditAssignment.id.in_(payload.assignment_ids))
    assignments = q.all()

    notified = []
    for a in assignments:
        email = a.user.email if a.user else getattr(a, "auditor_email", None)
        name = a.user.name if a.user else getattr(a, "auditor_name", "Auditor")
        # In production, send real email here. For now mark as sent.
        a.notify_sent = True
        if email:
            notified.append({"name": name, "email": email})
    db.commit()
    return {"ok": True, "notified": notified}


@admin_audit_router.post("/entries/{entry_id}/request-approval")
def admin_request_approval(
    entry_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    e = db.query(AuditEntry).filter(AuditEntry.id == entry_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Audit not found")
    assignments = db.query(AuditAssignment).filter(AuditAssignment.audit_id == entry_id).all()
    for a in assignments:
        a.approval_requested = True
    db.commit()
    return {"ok": True, "entry_id": entry_id}


@admin_audit_router.get("/directory")
def audit_directory(
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    from sqlalchemy import func as sqlfunc
    entries = db.query(AuditEntry).options(
        joinedload(AuditEntry.assignments).joinedload(AuditAssignment.user)
    ).all()

    customers: dict = {}   # client_name → count
    factories: dict = {}   # factory_name → count
    auditors: dict = {}    # email/name → {name, email, count}
    lead_auditors: dict = {}
    observers: dict = {}

    for e in entries:
        # Customers
        customers[e.client_name] = customers.get(e.client_name, 0) + 1
        # Factories
        fn = getattr(e, "factory_name", None) or e.company_name
        if fn:
            factories[fn] = factories.get(fn, 0) + 1
        # Assignments
        for a in (e.assignments or []):
            name = a.user.name if a.user else getattr(a, "auditor_name", "Unknown")
            email = a.user.email if a.user else getattr(a, "auditor_email", "")
            key = email or name
            role = a.role or "auditor"
            bucket = (
                lead_auditors if role == "lead"
                else observers if role == "observer"
                else auditors  # auditor + reviewer
            )
            if key not in bucket:
                bucket[key] = {"name": name, "email": email, "audit_count": 0}
            bucket[key]["audit_count"] += 1

    return {
        "customers": [{"name": k, "audit_count": v} for k, v in sorted(customers.items())],
        "factories": [{"name": k, "audit_count": v} for k, v in sorted(factories.items())],
        "auditors": list(auditors.values()),
        "lead_auditors": list(lead_auditors.values()),
        "observers": list(observers.values()),
    }


@admin_audit_router.get("/expenses")
def admin_list_expenses(
    status: Optional[str] = Query(None),
    audit_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    q = db.query(AuditExpense).options(
        joinedload(AuditExpense.user),
        joinedload(AuditExpense.audit_entry),
    )
    if status:
        q = q.filter(AuditExpense.status == status)
    if audit_id:
        q = q.filter(AuditExpense.audit_id == audit_id)
    return [_ser_expense(ex) for ex in q.order_by(desc(AuditExpense.submitted_at)).all()]


@admin_audit_router.post("/expenses/{expense_id}/review")
def admin_review_expense(
    expense_id: int,
    payload: ExpenseReview,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    if payload.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="status must be 'approved' or 'rejected'")
    ex = db.query(AuditExpense).filter(AuditExpense.id == expense_id).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Expense not found")
    ex.status = payload.status
    ex.review_note = payload.review_note
    ex.reviewed_by_id = admin.id
    ex.reviewed_at = datetime.utcnow()
    db.commit()
    ex = db.query(AuditExpense).options(joinedload(AuditExpense.user), joinedload(AuditExpense.audit_entry)).filter(AuditExpense.id == expense_id).first()
    return _ser_expense(ex)
