from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, UploadFile, File, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import Category, Transaction, User
from backend.schemas import (
    APIResponse,
    ImportResult,
    TransactionCreate,
    TransactionOut,
    TransactionUpdate,
)
from backend.services import csv_importer

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _enrich(txn: Transaction, db: Session) -> TransactionOut:
    out = TransactionOut.model_validate(txn)
    if txn.category_id:
        cat = db.query(Category).filter(Category.id == txn.category_id).first()
        if cat:
            out.category_name = cat.name
            out.category_color = cat.color
    return out


@router.get("", response_model=APIResponse[List[TransactionOut]])
def list_transactions(
    category_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    is_income: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Transaction).filter(
        Transaction.deleted_at.is_(None),
        Transaction.user_id == current_user.id,
    )
    if category_id is not None:
        q = q.filter(Transaction.category_id == category_id)
    if start_date is not None:
        q = q.filter(Transaction.date >= start_date)
    if end_date is not None:
        q = q.filter(Transaction.date <= end_date)
    if is_income is not None:
        q = q.filter(Transaction.is_income.is_(is_income))

    txns = q.order_by(Transaction.date.desc(), Transaction.id.desc()).offset(skip).limit(limit).all()
    return APIResponse(data=[_enrich(t, db) for t in txns])


@router.post("", response_model=APIResponse[TransactionOut], status_code=201)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.category_id is not None:
        if not db.query(Category).filter(Category.id == payload.category_id).first():
            return APIResponse(error=f"Category {payload.category_id} not found.")

    txn = Transaction(**payload.model_dump(), user_id=current_user.id)
    txn.is_income = payload.amount_cents > 0
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return APIResponse(data=_enrich(txn, db))


@router.put("/{transaction_id}", response_model=APIResponse[TransactionOut])
def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txn = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id,
        Transaction.deleted_at.is_(None),
    ).first()
    if not txn:
        return APIResponse(error=f"Transaction {transaction_id} not found.")

    update_data = payload.model_dump(exclude_unset=True)
    if "category_id" in update_data and update_data["category_id"] is not None:
        if not db.query(Category).filter(Category.id == update_data["category_id"]).first():
            return APIResponse(error=f"Category {update_data['category_id']} not found.")

    for field, value in update_data.items():
        setattr(txn, field, value)
    if "amount_cents" in update_data:
        txn.is_income = txn.amount_cents > 0
    txn.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(txn)
    return APIResponse(data=_enrich(txn, db))


@router.delete("/{transaction_id}", response_model=APIResponse[None])
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txn = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id,
        Transaction.deleted_at.is_(None),
    ).first()
    if not txn:
        return APIResponse(error=f"Transaction {transaction_id} not found.")

    txn.deleted_at = datetime.utcnow()
    db.commit()
    return APIResponse(data=None)


@router.post("/import", response_model=APIResponse[ImportResult])
async def import_transactions(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        return APIResponse(error="Only CSV files are accepted.")

    content = await file.read()
    try:
        result = csv_importer.import_csv(content, db, user_id=current_user.id)
    except Exception as exc:
        return APIResponse(error=f"Import failed: {str(exc)}")

    return APIResponse(data=result)
