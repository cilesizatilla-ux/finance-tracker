import os
import smtplib
import uuid
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import Category, SharedReport, Transaction, User
from backend.schemas import APIResponse, ShareCreate, ShareOut

router = APIRouter(tags=["shared"])


def _send_share_email(recipient_email: str, share_url: str, month: int, year: int, sender_name: Optional[str]) -> bool:
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")

    if not smtp_host or not smtp_user or not smtp_pass:
        return False

    month_name = datetime(year, month, 1).strftime("%B %Y")
    from_name = sender_name or "Finance Tracker"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Financial Report for {month_name}"
    msg["From"] = f"{from_name} <{smtp_user}>"
    msg["To"] = recipient_email

    html_body = f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background: #f4f4f5; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color: #1e293b; margin-top: 0;">Financial Report — {month_name}</h2>
    <p style="color: #475569;">{from_name} has shared their financial report with you.</p>
    <a href="{share_url}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #6366f1; color: #fff; border-radius: 8px; text-decoration: none; font-weight: bold;">
      View Report
    </a>
    <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
      This link is for viewing only. It may expire.
    </p>
  </div>
</body>
</html>
"""

    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, recipient_email, msg.as_string())
        return True
    except Exception:
        return False


@router.post("/reports/share", response_model=APIResponse[ShareOut])
def create_share(
    payload: ShareCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    token = str(uuid.uuid4()).replace("-", "")
    share_url = f"http://localhost:5174/shared/{token}"

    shared = SharedReport(
        user_id=current_user.id,
        token=token,
        month=payload.month,
        year=payload.year,
        recipient_email=payload.recipient_email,
    )
    db.add(shared)
    db.commit()
    db.refresh(shared)

    email_sent = False
    if payload.recipient_email:
        email_sent = _send_share_email(
            recipient_email=payload.recipient_email,
            share_url=share_url,
            month=payload.month,
            year=payload.year,
            sender_name=current_user.name,
        )

    return APIResponse(data=ShareOut(
        token=token,
        share_url=share_url,
        month=payload.month,
        year=payload.year,
        recipient_email=payload.recipient_email,
        email_sent=email_sent,
    ))


@router.get("/shared/{token}", response_model=APIResponse[dict])
def view_shared_report(
    token: str,
    db: Session = Depends(get_db),
):
    shared = db.query(SharedReport).filter(SharedReport.token == token).first()
    if not shared:
        raise HTTPException(status_code=404, detail="Shared report not found.")

    now = datetime.utcnow()
    if shared.expires_at is not None and shared.expires_at < now:
        raise HTTPException(status_code=404, detail="This shared report link has expired.")

    month = shared.month
    year = shared.year
    user_id = shared.user_id

    mm = f"{month:02d}"
    yy = str(year)

    # Fetch the report owner
    user = db.query(User).filter(User.id == user_id).first()
    user_name = user.name or user.email if user else "Unknown"

    # Summary totals
    income_cents = db.query(func.sum(Transaction.amount_cents)).filter(
        Transaction.user_id == user_id,
        Transaction.deleted_at.is_(None),
        Transaction.is_income.is_(True),
        func.strftime("%m", Transaction.date) == mm,
        func.strftime("%Y", Transaction.date) == yy,
    ).scalar() or 0

    expense_cents = db.query(func.sum(func.abs(Transaction.amount_cents))).filter(
        Transaction.user_id == user_id,
        Transaction.deleted_at.is_(None),
        Transaction.is_income.is_(False),
        func.strftime("%m", Transaction.date) == mm,
        func.strftime("%Y", Transaction.date) == yy,
    ).scalar() or 0

    net_cents = income_cents - expense_cents

    # Transactions list
    txns = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.deleted_at.is_(None),
        func.strftime("%m", Transaction.date) == mm,
        func.strftime("%Y", Transaction.date) == yy,
    ).order_by(Transaction.date.desc(), Transaction.id.desc()).all()

    transactions_list = []
    for t in txns:
        cat_name = None
        if t.category_id:
            cat = db.query(Category).filter(Category.id == t.category_id).first()
            if cat:
                cat_name = cat.name

        party_name = None
        if t.party_id:
            from backend.models import Party
            party = db.query(Party).filter(Party.id == t.party_id).first()
            if party:
                party_name = party.name

        transactions_list.append({
            "date": str(t.date),
            "description": t.description,
            "amount_cents": t.amount_cents,
            "is_income": t.is_income,
            "category_name": cat_name,
            "party_name": party_name,
        })

    # Category breakdown (expenses only)
    categories = db.query(Category).filter(
        or_(Category.user_id.is_(None), Category.user_id == user_id)
    ).all()

    category_breakdown = []
    for cat in categories:
        spent = db.query(func.sum(func.abs(Transaction.amount_cents))).filter(
            Transaction.category_id == cat.id,
            Transaction.user_id == user_id,
            Transaction.deleted_at.is_(None),
            Transaction.is_income.is_(False),
            func.strftime("%m", Transaction.date) == mm,
            func.strftime("%Y", Transaction.date) == yy,
        ).scalar() or 0
        if spent > 0:
            category_breakdown.append({
                "category": cat.name,
                "spent_cents": spent,
                "color": cat.color,
            })

    category_breakdown.sort(key=lambda x: -x["spent_cents"])

    return APIResponse(data={
        "user_name": user_name,
        "month": month,
        "year": year,
        "summary": {
            "income_cents": income_cents,
            "expense_cents": expense_cents,
            "net_cents": net_cents,
        },
        "transactions": transactions_list,
        "category_breakdown": category_breakdown,
    })
