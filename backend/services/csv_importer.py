import csv
import io
from datetime import datetime, date
from typing import List

from sqlalchemy.orm import Session

from backend.models import Category, Transaction
from backend.schemas import ImportResult, TransactionOut
from backend.services import categorizer


_DATE_FORMATS = ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"]


def _parse_date(value: str) -> date:
    value = value.strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Unrecognized date format: {value!r}")


def _parse_amount_cents(value: str) -> int:
    """Convert a dollar string (e.g. '-12.50', '1,234.00') to integer cents."""
    value = value.strip().replace(",", "").replace("$", "")
    return int(round(float(value) * 100))


def _get_or_create_category(name: str, db: Session) -> Category:
    cat = db.query(Category).filter(Category.name == name).first()
    if cat is None:
        cat = Category(name=name)
        db.add(cat)
        db.flush()
    return cat


def import_csv(file_content: bytes, db: Session, user_id: int = 1) -> ImportResult:
    text = file_content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    # Normalize header names to lowercase stripped keys
    raw_rows = list(reader)

    imported_txns: List[Transaction] = []
    imported = 0
    skipped = 0
    errors = 0

    # Fetch existing categories for the categorizer
    existing_categories = [c.name for c in db.query(Category).all()]

    for raw_row in raw_rows:
        # Normalize column names
        row = {k.strip().lower(): v.strip() for k, v in raw_row.items() if k}

        # Validate required columns
        if not all(col in row for col in ("date", "description", "amount")):
            errors += 1
            continue

        try:
            txn_date = _parse_date(row["date"])
            amount_cents = _parse_amount_cents(row["amount"])
            description = row["description"]
        except Exception:
            errors += 1
            continue

        # Duplicate check: (date, description, amount_cents) already exists
        duplicate = (
            db.query(Transaction)
            .filter(
                Transaction.date == txn_date,
                Transaction.description == description,
                Transaction.amount_cents == amount_cents,
                Transaction.deleted_at.is_(None),
            )
            .first()
        )
        if duplicate is not None:
            skipped += 1
            continue

        # Auto-categorize
        try:
            cat_result = categorizer.categorize_transaction(
                description, amount_cents, existing_categories
            )
            cat_name = cat_result.get("category_name", "Other")
        except Exception:
            cat_name = "Other"

        category = _get_or_create_category(cat_name, db)
        if cat_name not in existing_categories:
            existing_categories.append(cat_name)

        txn = Transaction(
            date=txn_date,
            description=description,
            amount_cents=amount_cents,
            category_id=category.id,
            user_id=user_id,
            is_income=amount_cents > 0,
            source="csv_import",
        )
        db.add(txn)
        imported_txns.append(txn)
        imported += 1

    db.commit()

    # Refresh to get IDs and timestamps
    for txn in imported_txns:
        db.refresh(txn)

    transactions_out = [TransactionOut.model_validate(t) for t in imported_txns]

    return ImportResult(
        imported=imported,
        skipped=skipped,
        errors=errors,
        transactions=transactions_out,
    )
