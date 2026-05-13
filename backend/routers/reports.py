from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import Category, Transaction, User
from backend.schemas import APIResponse, BudgetStatus, CashFlowItem, TransactionOut

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/cashflow", response_model=APIResponse[List[CashFlowItem]])
def get_cashflow(
    months: int = Query(6, ge=1, le=36),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import func
    now = datetime.utcnow()
    result: List[CashFlowItem] = []

    for i in range(months - 1, -1, -1):
        total_months = (now.year * 12 + now.month - 1) - i
        year = total_months // 12
        month = total_months % 12 + 1

        income = (
            db.query(func.sum(Transaction.amount_cents))
            .filter(
                Transaction.user_id == current_user.id,
                Transaction.deleted_at.is_(None),
                Transaction.is_income.is_(True),
                func.strftime("%m", Transaction.date) == f"{month:02d}",
                func.strftime("%Y", Transaction.date) == str(year),
            )
            .scalar() or 0
        )
        expense = (
            db.query(func.sum(func.abs(Transaction.amount_cents)))
            .filter(
                Transaction.user_id == current_user.id,
                Transaction.deleted_at.is_(None),
                Transaction.is_income.is_(False),
                func.strftime("%m", Transaction.date) == f"{month:02d}",
                func.strftime("%Y", Transaction.date) == str(year),
            )
            .scalar() or 0
        )
        result.append(CashFlowItem(month=month, year=year, income_cents=income, expense_cents=expense))

    return APIResponse(data=result)


@router.get("/budget", response_model=APIResponse[List[BudgetStatus]])
def get_budget_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import func
    now = datetime.utcnow()
    month = now.month
    year = now.year

    categories = db.query(Category).filter(
        or_(Category.user_id.is_(None), Category.user_id == current_user.id)
    ).order_by(Category.name).all()

    result = []
    for cat in categories:
        spent = (
            db.query(func.sum(func.abs(Transaction.amount_cents)))
            .filter(
                Transaction.category_id == cat.id,
                Transaction.user_id == current_user.id,
                Transaction.deleted_at.is_(None),
                Transaction.is_income.is_(False),
                func.strftime("%m", Transaction.date) == f"{month:02d}",
                func.strftime("%Y", Transaction.date) == str(year),
            )
            .scalar() or 0
        )
        result.append(BudgetStatus(
            category_id=cat.id,
            name=cat.name,
            budget_cents=cat.budget_cents,
            spent_cents=spent,
            color=cat.color,
        ))

    return APIResponse(data=result)


@router.get("/anomalies", response_model=APIResponse[List[TransactionOut]])
def get_anomalies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txns = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.is_anomaly.is_(True),
            Transaction.deleted_at.is_(None),
        )
        .order_by(Transaction.date.desc())
        .all()
    )
    return APIResponse(data=[TransactionOut.model_validate(t) for t in txns])
