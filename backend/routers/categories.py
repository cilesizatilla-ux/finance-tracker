from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import Category, Transaction, User
from backend.schemas import APIResponse, CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])


def _spending_this_month(category_id: int, user_id: int, db: Session) -> int:
    now = datetime.utcnow()
    from sqlalchemy import func
    total = (
        db.query(func.sum(func.abs(Transaction.amount_cents)))
        .filter(
            Transaction.category_id == category_id,
            Transaction.user_id == user_id,
            Transaction.deleted_at.is_(None),
            Transaction.is_income.is_(False),
            func.strftime("%m", Transaction.date) == f"{now.month:02d}",
            func.strftime("%Y", Transaction.date) == str(now.year),
        )
        .scalar()
    )
    return total or 0


def _visible(user_id: int):
    """Filter: global categories (user_id IS NULL) OR owned by this user."""
    return or_(Category.user_id.is_(None), Category.user_id == user_id)


@router.get("", response_model=APIResponse[List[CategoryOut]])
def list_categories(
    is_income: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Category).filter(_visible(current_user.id))
    if is_income is not None:
        q = q.filter(Category.is_income == is_income)
    categories = q.order_by(Category.name).all()
    out = []
    for cat in categories:
        cat_out = CategoryOut.model_validate(cat)
        cat_out.spending_cents = _spending_this_month(cat.id, current_user.id, db)
        out.append(cat_out)
    return APIResponse(data=out)


@router.post("", response_model=APIResponse[CategoryOut], status_code=201)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(Category).filter(
        Category.name == payload.name,
        _visible(current_user.id),
    ).first()
    if existing:
        return APIResponse(error=f"Category '{payload.name}' already exists.")

    cat = Category(**payload.model_dump(), user_id=current_user.id)
    db.add(cat)
    db.commit()
    db.refresh(cat)

    cat_out = CategoryOut.model_validate(cat)
    cat_out.spending_cents = 0
    return APIResponse(data=cat_out)


@router.put("/{category_id}", response_model=APIResponse[CategoryOut])
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cat = db.query(Category).filter(
        Category.id == category_id,
        _visible(current_user.id),
    ).first()
    if not cat:
        return APIResponse(error=f"Category {category_id} not found.")

    update_data = payload.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] != cat.name:
        clash = db.query(Category).filter(
            Category.name == update_data["name"],
            _visible(current_user.id),
        ).first()
        if clash:
            return APIResponse(error=f"Category name '{update_data['name']}' already in use.")

    for field, value in update_data.items():
        setattr(cat, field, value)
    cat.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(cat)

    cat_out = CategoryOut.model_validate(cat)
    cat_out.spending_cents = _spending_this_month(cat.id, current_user.id, db)
    return APIResponse(data=cat_out)


@router.delete("/{category_id}", response_model=APIResponse[None])
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cat = db.query(Category).filter(
        Category.id == category_id,
        _visible(current_user.id),
    ).first()
    if not cat:
        return APIResponse(error=f"Category {category_id} not found.")

    txn_count = (
        db.query(Transaction)
        .filter(
            Transaction.category_id == category_id,
            Transaction.user_id == current_user.id,
            Transaction.deleted_at.is_(None),
        )
        .count()
    )
    if txn_count > 0:
        return APIResponse(
            error=f"Cannot delete category '{cat.name}' — it has {txn_count} active transaction(s)."
        )

    db.delete(cat)
    db.commit()
    return APIResponse(data=None)
