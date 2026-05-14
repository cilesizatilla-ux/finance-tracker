"""
Admin backend router.
All endpoints live under /admin (prefix /api/v1 added in main.py).
"""
import json
import statistics
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session

from jose import jwt as jose_jwt

from backend.admin_auth import (
    create_admin_token,
    get_current_admin,
    hash_password,
    require_super_admin,
    verify_password,
)
from backend.auth import ALGORITHM, SECRET_KEY
from backend.database import get_db
from backend.models import (
    AdminAuditLog,
    AdminUser,
    Category,
    Transaction,
    User,
    UserProfile,
)
from backend.schemas import APIResponse

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _log_audit(
    db: Session,
    admin_id: int,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    detail: Optional[dict] = None,
) -> None:
    log = AdminAuditLog(
        admin_id=admin_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        detail=json.dumps(detail) if detail else None,
    )
    db.add(log)
    db.commit()


def _get_or_create_profile(db: Session, user_id: int) -> UserProfile:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not profile:
        profile = UserProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


# ---------------------------------------------------------------------------
# Auth endpoints (no admin auth required)
# ---------------------------------------------------------------------------

@router.post("/auth/login")
def admin_login(
    payload: dict,
    db: Session = Depends(get_db),
):
    username = payload.get("username", "").strip()
    password = payload.get("password", "")

    admin = db.query(AdminUser).filter(
        or_(AdminUser.username == username, AdminUser.email == username)
    ).first()
    if not admin or not verify_password(password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not admin.is_active:
        raise HTTPException(status_code=403, detail="Admin account is inactive")

    admin.last_login_at = datetime.now(timezone.utc)
    db.commit()

    token = create_admin_token(admin.id, admin.username, admin.role)
    return APIResponse(data={
        "access_token": token,
        "admin": {
            "id": admin.id,
            "username": admin.username,
            "email": admin.email,
            "role": admin.role,
        },
    })


@router.get("/auth/me")
def admin_me(
    current_admin: AdminUser = Depends(get_current_admin),
):
    return APIResponse(data={
        "id": current_admin.id,
        "username": current_admin.username,
        "email": current_admin.email,
        "role": current_admin.role,
        "is_active": current_admin.is_active,
        "last_login_at": current_admin.last_login_at.isoformat() if current_admin.last_login_at else None,
        "created_at": current_admin.created_at.isoformat(),
    })


# ---------------------------------------------------------------------------
# User Management
# ---------------------------------------------------------------------------

@router.get("/users")
def list_users(
    page: int = Query(0, ge=0),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    q = db.query(User)
    if search:
        q = q.filter(
            or_(
                User.email.ilike(f"%{search}%"),
                User.name.ilike(f"%{search}%"),
            )
        )
    total = q.count()
    users = q.order_by(User.created_at.desc()).offset(page * per_page).limit(per_page).all()

    user_ids = [u.id for u in users]

    # Batch: transaction counts and totals
    txn_stats = (
        db.query(
            Transaction.user_id,
            func.count(Transaction.id).label("txn_count"),
            func.sum(
                case(
                    (Transaction.is_income == True, Transaction.amount_cents),
                    else_=0,
                )
            ).label("total_income"),
            func.sum(
                case(
                    (Transaction.is_income == False, func.abs(Transaction.amount_cents)),
                    else_=0,
                )
            ).label("total_expense"),
        )
        .filter(
            Transaction.user_id.in_(user_ids),
            Transaction.deleted_at.is_(None),
        )
        .group_by(Transaction.user_id)
        .all()
    )
    txn_map = {r.user_id: r for r in txn_stats}

    # Batch: profiles (for is_suspended)
    profiles = db.query(UserProfile).filter(UserProfile.user_id.in_(user_ids)).all()
    profile_map = {p.user_id: p for p in profiles}

    result = []
    for u in users:
        stats = txn_map.get(u.id)
        profile = profile_map.get(u.id)
        last_active = getattr(u, "last_active_at", None)
        result.append({
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "created_at": u.created_at.isoformat(),
            "is_suspended": profile.is_suspended if profile else False,
            "transaction_count": stats.txn_count if stats else 0,
            "total_income_cents": stats.total_income if stats else 0,
            "total_expense_cents": stats.total_expense if stats else 0,
            "last_active_at": last_active.isoformat() if last_active else None,
        })

    return APIResponse(data=result, total=total)


@router.get("/users/{user_id}")
def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()

    # Stats
    txns = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id, Transaction.deleted_at.is_(None))
        .all()
    )
    txn_count = len(txns)
    total_income = sum(t.amount_cents for t in txns if t.is_income)
    total_expense = sum(abs(t.amount_cents) for t in txns if not t.is_income)
    avg_txn = (
        round(sum(abs(t.amount_cents) for t in txns) / txn_count)
        if txn_count else 0
    )

    # Top category by spend
    cat_totals: dict = {}
    for t in txns:
        if not t.is_income and t.category_id:
            cat_totals[t.category_id] = cat_totals.get(t.category_id, 0) + abs(t.amount_cents)
    top_cat_name = None
    if cat_totals:
        top_cat_id = max(cat_totals, key=lambda k: cat_totals[k])
        cat = db.query(Category).filter(Category.id == top_cat_id).first()
        top_cat_name = cat.name if cat else None

    # Date range
    dates = [t.date for t in txns]
    first_txn_date = str(min(dates)) if dates else None
    last_txn_date = str(max(dates)) if dates else None

    # Streak: count distinct active days in last 90 days
    cutoff = datetime.now(timezone.utc).date() - timedelta(days=90)
    active_days = {t.date for t in txns if t.date >= cutoff}
    streak_days = len(active_days)

    last_active = getattr(user, "last_active_at", None)

    return APIResponse(data={
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "avatar_url": user.avatar_url,
        "created_at": user.created_at.isoformat(),
        "last_active_at": last_active.isoformat() if last_active else None,
        "profile": {
            "country": profile.country if profile else None,
            "currency": profile.currency if profile else None,
            "income_bracket": profile.income_bracket if profile else None,
            "financial_goal": profile.financial_goal if profile else None,
            "occupation": profile.occupation if profile else None,
            "is_suspended": profile.is_suspended if profile else False,
            "suspended_at": profile.suspended_at.isoformat() if profile and profile.suspended_at else None,
        },
        "stats": {
            "transaction_count": txn_count,
            "total_income_cents": total_income,
            "total_expense_cents": total_expense,
            "avg_transaction_cents": avg_txn,
            "top_category": top_cat_name,
            "first_transaction_date": first_txn_date,
            "last_transaction_date": last_txn_date,
            "streak_days_active": streak_days,
        },
    })


@router.get("/users/{user_id}/transactions")
def get_user_transactions(
    user_id: int,
    page: int = Query(0, ge=0),
    per_page: int = Query(20, ge=1, le=100),
    is_income: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    q = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.deleted_at.is_(None),
    )
    if is_income is not None:
        q = q.filter(Transaction.is_income == is_income)

    total = q.count()
    txns = q.order_by(Transaction.date.desc(), Transaction.id.desc()).offset(page * per_page).limit(per_page).all()

    cat_ids = {t.category_id for t in txns if t.category_id}
    cat_map = {c.id: c for c in db.query(Category).filter(Category.id.in_(cat_ids)).all()} if cat_ids else {}

    result = []
    for t in txns:
        cat = cat_map.get(t.category_id) if t.category_id else None
        result.append({
            "id": t.id,
            "date": str(t.date),
            "description": t.description,
            "amount_cents": t.amount_cents,
            "is_income": t.is_income,
            "is_anomaly": t.is_anomaly,
            "category_id": t.category_id,
            "category_name": cat.name if cat else None,
            "category_color": cat.color if cat else None,
            "payment_method": t.payment_method,
            "source": t.source,
            "created_at": t.created_at.isoformat(),
        })

    return APIResponse(data=result, total=total)


@router.patch("/users/{user_id}/suspend")
def toggle_suspend_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    profile = _get_or_create_profile(db, user_id)
    profile.is_suspended = not profile.is_suspended
    profile.suspended_at = datetime.now(timezone.utc) if profile.is_suspended else None
    profile.updated_at = datetime.now(timezone.utc)
    db.commit()

    action = "suspend_user" if profile.is_suspended else "unsuspend_user"
    _log_audit(
        db, current_admin.id, action,
        target_type="user", target_id=user_id,
        detail={"email": user.email, "is_suspended": profile.is_suspended},
    )

    return APIResponse(data={
        "user_id": user_id,
        "is_suspended": profile.is_suspended,
        "suspended_at": profile.suspended_at.isoformat() if profile.suspended_at else None,
    })


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(require_super_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Soft-delete all user transactions
    now = datetime.now(timezone.utc)
    db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.deleted_at.is_(None),
    ).update({"deleted_at": now})
    db.commit()

    user_email = user.email
    db.delete(user)
    db.commit()

    _log_audit(
        db, current_admin.id, "delete_user",
        target_type="user", target_id=user_id,
        detail={"email": user_email},
    )

    return APIResponse(data={"deleted": True, "user_id": user_id})


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

@router.get("/analytics/overview")
def analytics_overview(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    total_users = db.query(func.count(User.id)).scalar() or 0

    cutoff_30 = datetime.now(timezone.utc) - timedelta(days=30)
    # Use last_active_at if available (column added via migration)
    try:
        active_users = (
            db.query(func.count(User.id))
            .filter(User.last_active_at >= cutoff_30)
            .scalar() or 0
        )
    except Exception:
        active_users = 0

    suspended_users = (
        db.query(func.count(UserProfile.id))
        .filter(UserProfile.is_suspended == True)
        .scalar() or 0
    )

    total_transactions = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.deleted_at.is_(None))
        .scalar() or 0
    )

    income_result = (
        db.query(func.sum(Transaction.amount_cents))
        .filter(Transaction.deleted_at.is_(None), Transaction.is_income == True)
        .scalar() or 0
    )
    expense_result = (
        db.query(func.sum(func.abs(Transaction.amount_cents)))
        .filter(Transaction.deleted_at.is_(None), Transaction.is_income == False)
        .scalar() or 0
    )

    now = datetime.now(timezone.utc)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    new_users_this_month = (
        db.query(func.count(User.id))
        .filter(User.created_at >= month_start)
        .scalar() or 0
    )

    avg_txn_per_user = (
        round(total_transactions / total_users, 2)
        if total_users else 0
    )

    return APIResponse(data={
        "total_users": total_users,
        "active_users": active_users,
        "suspended_users": suspended_users,
        "total_transactions": total_transactions,
        "total_income_cents": income_result,
        "total_expense_cents": expense_result,
        "new_users_this_month": new_users_this_month,
        "avg_transactions_per_user": avg_txn_per_user,
    })


@router.get("/analytics/trends")
def analytics_trends(
    months: int = Query(12, ge=1, le=60),
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    rows = (
        db.query(
            func.strftime("%Y-%m", Transaction.date).label("month"),
            func.sum(
                case((Transaction.is_income == True, Transaction.amount_cents), else_=0)
            ).label("income_cents"),
            func.sum(
                case((Transaction.is_income == False, func.abs(Transaction.amount_cents)), else_=0)
            ).label("expense_cents"),
            func.count(Transaction.id).label("transaction_count"),
            func.count(func.distinct(Transaction.user_id)).label("unique_users"),
        )
        .filter(Transaction.deleted_at.is_(None))
        .group_by(func.strftime("%Y-%m", Transaction.date))
        .order_by(func.strftime("%Y-%m", Transaction.date).desc())
        .limit(months)
        .all()
    )

    result = [
        {
            "month": r.month,
            "income_cents": r.income_cents or 0,
            "expense_cents": r.expense_cents or 0,
            "transaction_count": r.transaction_count,
            "unique_users": r.unique_users,
        }
        for r in reversed(rows)
    ]
    return APIResponse(data=result)


@router.get("/analytics/categories")
def analytics_categories(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    rows = (
        db.query(
            Category.name.label("category_name"),
            Category.color.label("color"),
            func.sum(func.abs(Transaction.amount_cents)).label("total_cents"),
            func.count(func.distinct(Transaction.user_id)).label("user_count"),
            func.count(Transaction.id).label("transaction_count"),
        )
        .join(Transaction, Transaction.category_id == Category.id)
        .filter(
            Transaction.deleted_at.is_(None),
            Transaction.is_income == False,
        )
        .group_by(Category.id)
        .order_by(func.sum(func.abs(Transaction.amount_cents)).desc())
        .limit(10)
        .all()
    )

    return APIResponse(data=[
        {
            "category_name": r.category_name,
            "color": r.color,
            "total_cents": r.total_cents or 0,
            "user_count": r.user_count,
            "transaction_count": r.transaction_count,
        }
        for r in rows
    ])


@router.get("/analytics/benchmarks")
def analytics_benchmarks(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    now = datetime.now(timezone.utc).date()
    three_months_ago = now - timedelta(days=90)

    # Fetch raw data: category, user, total spend per user per month
    rows = (
        db.query(
            Category.id.label("cat_id"),
            Category.name.label("category_name"),
            Category.color.label("color"),
            Transaction.user_id,
            func.strftime("%Y-%m", Transaction.date).label("month"),
            func.sum(func.abs(Transaction.amount_cents)).label("monthly_spend"),
        )
        .join(Transaction, Transaction.category_id == Category.id)
        .filter(
            Transaction.deleted_at.is_(None),
            Transaction.is_income == False,
            Transaction.date >= three_months_ago,
        )
        .group_by(Category.id, Transaction.user_id, func.strftime("%Y-%m", Transaction.date))
        .all()
    )

    # Group monthly spends by category
    from collections import defaultdict
    cat_meta: dict = {}
    cat_spends: dict = defaultdict(list)

    for r in rows:
        cat_meta[r.cat_id] = {"category_name": r.category_name, "color": r.color}
        cat_spends[r.cat_id].append(r.monthly_spend)

    result = []
    for cat_id, spends in cat_spends.items():
        sorted_spends = sorted(spends)
        n = len(sorted_spends)
        avg = round(sum(sorted_spends) / n) if n else 0
        med = round(statistics.median(sorted_spends)) if n else 0

        def percentile(data, pct):
            if not data:
                return 0
            idx = (pct / 100) * (len(data) - 1)
            lo = int(idx)
            hi = min(lo + 1, len(data) - 1)
            frac = idx - lo
            return round(data[lo] + frac * (data[hi] - data[lo]))

        p25 = percentile(sorted_spends, 25)
        p75 = percentile(sorted_spends, 75)
        user_count = len({r.user_id for r in rows if r.cat_id == cat_id})

        result.append({
            "category_name": cat_meta[cat_id]["category_name"],
            "color": cat_meta[cat_id]["color"],
            "avg_monthly_spend_cents": avg,
            "median_cents": med,
            "p25_cents": p25,
            "p75_cents": p75,
            "user_count": user_count,
        })

    result.sort(key=lambda x: x["avg_monthly_spend_cents"], reverse=True)
    return APIResponse(data=result)


@router.get("/analytics/user-growth")
def analytics_user_growth(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    rows = (
        db.query(
            func.strftime("%Y-%m", User.created_at).label("month"),
            func.count(User.id).label("new_users"),
        )
        .group_by(func.strftime("%Y-%m", User.created_at))
        .order_by(func.strftime("%Y-%m", User.created_at))
        .all()
    )

    result = []
    cumulative = 0
    for r in rows:
        cumulative += r.new_users
        result.append({
            "month": r.month,
            "new_users": r.new_users,
            "cumulative_users": cumulative,
        })

    # Return last 12 months only
    return APIResponse(data=result[-12:])


@router.get("/analytics/payment-methods")
def analytics_payment_methods(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    rows = (
        db.query(
            Transaction.payment_method.label("method"),
            func.count(Transaction.id).label("count"),
            func.sum(func.abs(Transaction.amount_cents)).label("total_cents"),
        )
        .filter(Transaction.deleted_at.is_(None))
        .group_by(Transaction.payment_method)
        .order_by(func.count(Transaction.id).desc())
        .all()
    )

    return APIResponse(data=[
        {
            "method": r.method or "unspecified",
            "count": r.count,
            "total_cents": r.total_cents or 0,
        }
        for r in rows
    ])


@router.get("/analytics/anomalies")
def analytics_anomalies(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    rows = (
        db.query(Transaction, User.email)
        .join(User, User.id == Transaction.user_id)
        .filter(
            Transaction.is_anomaly == True,
            Transaction.deleted_at.is_(None),
        )
        .order_by(Transaction.created_at.desc())
        .limit(50)
        .all()
    )

    result = []
    for txn, email in rows:
        result.append({
            "id": txn.id,
            "user_email": email,
            "date": str(txn.date),
            "description": txn.description,
            "amount_cents": txn.amount_cents,
            "is_income": txn.is_income,
            "created_at": txn.created_at.isoformat(),
        })

    return APIResponse(data=result)


@router.get("/analytics/category-breakdown", dependencies=[Depends(get_current_admin)])
def category_breakdown(db: Session = Depends(get_db)):
    from datetime import date, timedelta
    cutoff = date.today() - timedelta(days=30)
    rows = (
        db.query(
            Category.name,
            Category.color,
            func.sum(func.abs(Transaction.amount_cents)).label("total_cents"),
            func.count(Transaction.id).label("tx_count"),
        )
        .join(Transaction, Transaction.category_id == Category.id)
        .filter(
            Transaction.deleted_at.is_(None),
            Transaction.is_income.is_(False),
            Transaction.date >= cutoff,
        )
        .group_by(Category.id, Category.name, Category.color)
        .order_by(func.sum(func.abs(Transaction.amount_cents)).desc())
        .limit(10)
        .all()
    )
    return APIResponse(data=[
        {"name": r.name, "color": r.color or "#6366f1", "total_cents": r.total_cents, "tx_count": r.tx_count}
        for r in rows
    ])


@router.get("/analytics/budget-compliance", dependencies=[Depends(get_current_admin)])
def budget_compliance(db: Session = Depends(get_db)):
    from datetime import date
    today = date.today()
    month_start = today.replace(day=1)
    # Users who have at least one category with a non-zero budget assigned to them
    users_with_budget = (
        db.query(Category.user_id)
        .filter(Category.user_id.isnot(None), Category.budget_cents > 0)
        .distinct()
        .count()
    )
    total_users = db.query(func.count(User.id)).scalar() or 0
    if users_with_budget == 0:
        return APIResponse(data={"budget_adoption_pct": 0, "users_with_budget": 0, "total_users": total_users})
    return APIResponse(data={
        "users_with_budget": users_with_budget,
        "total_users": total_users,
        "budget_adoption_pct": round(users_with_budget / max(total_users, 1) * 100, 1),
    })


@router.get("/analytics/recommendations")
def analytics_recommendations(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    insights = []

    # Users with no profile data
    all_user_ids = [u.id for u in db.query(User.id).all()]
    profiled_ids = {p.user_id for p in db.query(UserProfile.user_id).all()}
    missing_profile = len(all_user_ids) - len(profiled_ids)
    if missing_profile:
        insights.append({
            "type": "missing_profile",
            "message": f"{missing_profile} user(s) have no profile data.",
            "count": missing_profile,
        })

    # Users with incomplete profiles (missing country or currency)
    incomplete = (
        db.query(func.count(UserProfile.id))
        .filter(
            or_(UserProfile.country.is_(None), UserProfile.currency.is_(None))
        )
        .scalar() or 0
    )
    if incomplete:
        insights.append({
            "type": "incomplete_profile",
            "message": f"{incomplete} user(s) have incomplete profile information.",
            "count": incomplete,
        })

    # Users with no transactions
    txn_user_ids = {
        r[0]
        for r in db.query(Transaction.user_id)
        .filter(Transaction.deleted_at.is_(None))
        .distinct()
        .all()
    }
    no_txn = len([uid for uid in all_user_ids if uid not in txn_user_ids])
    if no_txn:
        insights.append({
            "type": "no_transactions",
            "message": f"{no_txn} user(s) have no transactions.",
            "count": no_txn,
        })

    # Categories with 0 budget
    zero_budget = (
        db.query(func.count(Category.id))
        .filter(Category.budget_cents == 0, Category.is_income == False)
        .scalar() or 0
    )
    if zero_budget:
        insights.append({
            "type": "zero_budget_categories",
            "message": f"{zero_budget} expense category(ies) have no budget set.",
            "count": zero_budget,
        })

    # Anomaly transactions not reviewed
    anomaly_count = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.is_anomaly == True, Transaction.deleted_at.is_(None))
        .scalar() or 0
    )
    if anomaly_count:
        insights.append({
            "type": "unreviewed_anomalies",
            "message": f"{anomaly_count} transaction(s) are flagged as anomalies.",
            "count": anomaly_count,
        })

    return APIResponse(data=insights)


# ---------------------------------------------------------------------------
# Admin Management (super_admin only)
# ---------------------------------------------------------------------------

@router.get("/admins")
def list_admins(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(require_super_admin),
):
    admins = db.query(AdminUser).order_by(AdminUser.created_at.desc()).all()

    admin_ids = [a.created_by_id for a in admins if a.created_by_id]
    creator_map = {}
    if admin_ids:
        creators = db.query(AdminUser).filter(AdminUser.id.in_(admin_ids)).all()
        creator_map = {c.id: c.username for c in creators}

    result = []
    for a in admins:
        result.append({
            "id": a.id,
            "username": a.username,
            "email": a.email,
            "role": a.role,
            "is_active": a.is_active,
            "created_by": creator_map.get(a.created_by_id) if a.created_by_id else None,
            "last_login_at": a.last_login_at.isoformat() if a.last_login_at else None,
            "created_at": a.created_at.isoformat(),
        })

    return APIResponse(data=result)


@router.post("/admins", status_code=201)
def create_admin(
    payload: dict,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(require_super_admin),
):
    username = payload.get("username", "").strip()
    email = payload.get("email", "").strip()
    password = payload.get("password", "")
    role = payload.get("role", "admin")

    if role not in ("admin", "super_admin"):
        raise HTTPException(status_code=400, detail="role must be 'admin' or 'super_admin'")
    if not username or not email or not password:
        raise HTTPException(status_code=400, detail="username, email, and password are required")

    if db.query(AdminUser).filter(AdminUser.username == username).first():
        raise HTTPException(status_code=409, detail=f"Username '{username}' already exists")
    if db.query(AdminUser).filter(AdminUser.email == email).first():
        raise HTTPException(status_code=409, detail=f"Email '{email}' already exists")

    new_admin = AdminUser(
        username=username,
        email=email,
        password_hash=hash_password(password),
        role=role,
        is_active=True,
        created_by_id=current_admin.id,
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)

    _log_audit(
        db, current_admin.id, "create_admin",
        target_type="admin", target_id=new_admin.id,
        detail={"username": username, "role": role},
    )

    return APIResponse(data={
        "id": new_admin.id,
        "username": new_admin.username,
        "email": new_admin.email,
        "role": new_admin.role,
        "is_active": new_admin.is_active,
        "created_at": new_admin.created_at.isoformat(),
    })


@router.patch("/admins/{admin_id}/toggle")
def toggle_admin(
    admin_id: int,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(require_super_admin),
):
    target = db.query(AdminUser).filter(AdminUser.id == admin_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found")
    if target.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    target.is_active = not target.is_active
    target.updated_at = datetime.now(timezone.utc)
    db.commit()

    action = "activate_admin" if target.is_active else "deactivate_admin"
    _log_audit(
        db, current_admin.id, action,
        target_type="admin", target_id=admin_id,
        detail={"username": target.username, "is_active": target.is_active},
    )

    return APIResponse(data={"admin_id": admin_id, "is_active": target.is_active})


@router.delete("/admins/{admin_id}")
def delete_admin(
    admin_id: int,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(require_super_admin),
):
    target = db.query(AdminUser).filter(AdminUser.id == admin_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found")
    if target.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    # Prevent deleting the only active super_admin
    if target.role == "super_admin" and target.is_active:
        super_count = (
            db.query(func.count(AdminUser.id))
            .filter(AdminUser.role == "super_admin", AdminUser.is_active == True)
            .scalar() or 0
        )
        if super_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the only super_admin",
            )

    username = target.username
    db.delete(target)
    db.commit()

    _log_audit(
        db, current_admin.id, "delete_admin",
        target_type="admin", target_id=admin_id,
        detail={"username": username},
    )

    return APIResponse(data={"deleted": True, "admin_id": admin_id})


@router.get("/audit-logs")
def list_audit_logs(
    page: int = Query(0, ge=0),
    per_page: int = Query(20, ge=1, le=100),
    admin_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(require_super_admin),
):
    q = db.query(AdminAuditLog)
    if admin_id is not None:
        q = q.filter(AdminAuditLog.admin_id == admin_id)

    total = q.count()
    logs = q.order_by(AdminAuditLog.created_at.desc()).offset(page * per_page).limit(per_page).all()

    admin_ids = list({log.admin_id for log in logs})
    admins = db.query(AdminUser).filter(AdminUser.id.in_(admin_ids)).all()
    admin_map = {a.id: a.username for a in admins}

    result = [
        {
            "id": log.id,
            "admin_id": log.admin_id,
            "admin_username": admin_map.get(log.admin_id, "unknown"),
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "detail": log.detail,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]

    return APIResponse(data=result, total=total)


# ---------------------------------------------------------------------------
# User Password Reset
# ---------------------------------------------------------------------------

class PasswordResetPayload(BaseModel):
    new_password: str

@router.post("/users/{user_id}/reset-password")
def admin_reset_user_password(
    user_id: int,
    payload: PasswordResetPayload,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    user.password_hash = hash_password(payload.new_password)
    db.add(AdminAuditLog(
        admin_id=admin.id,
        action="reset_user_password",
        target_type="User",
        target_id=user_id,
        detail=json.dumps({"message": f"Password reset by admin {admin.username}"}),
    ))
    db.commit()
    return APIResponse(data={"message": "Password reset successfully"})


# ---------------------------------------------------------------------------
# User Impersonation
# ---------------------------------------------------------------------------

@router.post("/users/{user_id}/impersonate")
def impersonate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(require_super_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if profile and profile.is_suspended:
        raise HTTPException(status_code=403, detail="Cannot impersonate a suspended user")

    expire = datetime.now(timezone.utc) + timedelta(hours=1)
    token = jose_jwt.encode(
        {"sub": str(user.id), "email": user.email, "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )

    _log_audit(
        db, current_admin.id, "impersonate_user",
        target_type="User", target_id=user_id,
        detail={"email": user.email},
    )

    return APIResponse(data={"token": token, "user_email": user.email})


# ---------------------------------------------------------------------------
# Notifications (broadcast)
# ---------------------------------------------------------------------------

class BroadcastPayload(BaseModel):
    title: str
    body: str

@router.post("/notifications/broadcast")
def broadcast_notification(
    payload: BroadcastPayload,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    from backend.models import Notification
    if not payload.title.strip():
        raise HTTPException(status_code=422, detail="Title is required")
    notif = Notification(title=payload.title.strip(), body=payload.body.strip() or None, created_by_id=admin.id)
    db.add(notif)
    db.flush()
    db.add(AdminAuditLog(admin_id=admin.id, action="broadcast_notification", target_type="Notification", target_id=notif.id, detail=json.dumps({"title": payload.title})))
    db.commit()
    return APIResponse(data={"message": "Notification broadcast", "id": notif.id})

@router.get("/analytics/daily-activity", dependencies=[Depends(get_current_admin)])
def daily_activity(db: Session = Depends(get_db)):
    from datetime import date, timedelta
    from sqlalchemy import cast, Date

    end_date = date.today()
    start_date = end_date - timedelta(days=89)  # 90 days inclusive

    # Count users who were last active on each day using last_active_at
    # Group by date and count distinct users
    rows = (
        db.query(
            cast(User.last_active_at, Date).label("day"),
            func.count(User.id).label("count"),
        )
        .filter(
            User.last_active_at.isnot(None),
            cast(User.last_active_at, Date) >= start_date,
            cast(User.last_active_at, Date) <= end_date,
        )
        .group_by(cast(User.last_active_at, Date))
        .all()
    )

    # Build a full dict for all 90 days (0 for missing days)
    day_map = {str(r.day): r.count for r in rows}
    result = []
    for i in range(90):
        d = start_date + timedelta(days=i)
        result.append({"date": str(d), "count": day_map.get(str(d), 0)})

    return APIResponse(data=result)


@router.get("/notifications")
def list_admin_notifications(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    from backend.models import Notification
    notifs = db.query(Notification).order_by(Notification.created_at.desc()).limit(50).all()
    return APIResponse(data=[{
        "id": n.id, "title": n.title, "body": n.body,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    } for n in notifs])


# ---------------------------------------------------------------------------
# System Health
# ---------------------------------------------------------------------------

@router.get("/analytics/system-overview")
def system_overview(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    from backend.models import AuditEntry
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_transactions = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.deleted_at.is_(None))
        .scalar() or 0
    )
    total_volume = (
        db.query(func.sum(func.abs(Transaction.amount_cents)))
        .filter(Transaction.deleted_at.is_(None))
        .scalar() or 0
    )
    total_audits = db.query(func.count(AuditEntry.id)).scalar() or 0
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    new_users_30d = (
        db.query(func.count(User.id))
        .filter(User.created_at >= cutoff)
        .scalar() or 0
    )
    return APIResponse(data={
        "total_users": total_users,
        "total_transactions": total_transactions,
        "total_volume_cents": int(total_volume),
        "total_audits": total_audits,
        "new_users_30d": new_users_30d,
    })


@router.get("/analytics/monthly-volume")
def monthly_volume(
    db: Session = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    import calendar as cal_mod
    from sqlalchemy import extract

    results = []
    today = datetime.now(timezone.utc).date()
    for i in range(11, -1, -1):
        month_offset = today.month - i
        year_offset = today.year
        while month_offset <= 0:
            month_offset += 12
            year_offset -= 1

        q = db.query(
            func.count(Transaction.id).label("count"),
            func.coalesce(func.sum(func.abs(Transaction.amount_cents)), 0).label("volume"),
        ).filter(
            Transaction.deleted_at.is_(None),
            extract("year", Transaction.date) == year_offset,
            extract("month", Transaction.date) == month_offset,
        )
        row = q.first()
        month_name = cal_mod.month_abbr[month_offset]
        results.append({
            "label": f"{month_name} {str(year_offset)[2:]}",
            "month": month_offset,
            "year": year_offset,
            "tx_count": row.count if row else 0,
            "volume_cents": int(row.volume) if row else 0,
        })
    return APIResponse(data=results)
