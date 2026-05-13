import json
import os
from datetime import datetime
from typing import List

import anthropic
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models import Category, Transaction
from backend.services.agent_tools import ADVISOR_TOOLS

_MODEL = "claude-sonnet-4-6"
_MAX_ITERATIONS = 10

_SYSTEM_PROMPT = (
    "You are a personal finance advisor. "
    "Answer questions about the user's finances concisely and helpfully. "
    "Use the tools to fetch real data before answering."
)


# ---------------------------------------------------------------------------
# Tool handler implementations
# ---------------------------------------------------------------------------

def _get_spending_by_category(month: int, year: int, db: Session, user_id: int) -> dict:
    rows = (
        db.query(Category.name, func.sum(func.abs(Transaction.amount_cents)))
        .join(Transaction, Transaction.category_id == Category.id)
        .filter(
            Transaction.user_id == user_id,
            Transaction.deleted_at.is_(None),
            Transaction.is_income.is_(False),
            func.strftime("%m", Transaction.date) == f"{month:02d}",
            func.strftime("%Y", Transaction.date) == str(year),
        )
        .group_by(Category.id)
        .all()
    )
    return {name: total for name, total in rows}


def _get_budget_status(db: Session, user_id: int) -> list:
    from sqlalchemy import or_
    now = datetime.utcnow()
    month = now.month
    year = now.year

    categories = db.query(Category).filter(
        or_(Category.user_id.is_(None), Category.user_id == user_id)
    ).all()
    result = []
    for cat in categories:
        spent = (
            db.query(func.sum(func.abs(Transaction.amount_cents)))
            .filter(
                Transaction.category_id == cat.id,
                Transaction.user_id == user_id,
                Transaction.deleted_at.is_(None),
                Transaction.is_income.is_(False),
                func.strftime("%m", Transaction.date) == f"{month:02d}",
                func.strftime("%Y", Transaction.date) == str(year),
            )
            .scalar()
            or 0
        )
        result.append({
            "category_id": cat.id,
            "name": cat.name,
            "budget_cents": cat.budget_cents,
            "spent_cents": spent,
            "color": cat.color,
        })
    return result


def _get_cash_flow(month: int, year: int, db: Session, user_id: int) -> dict:
    income = (
        db.query(func.sum(Transaction.amount_cents))
        .filter(
            Transaction.user_id == user_id,
            Transaction.deleted_at.is_(None),
            Transaction.is_income.is_(True),
            func.strftime("%m", Transaction.date) == f"{month:02d}",
            func.strftime("%Y", Transaction.date) == str(year),
        )
        .scalar()
        or 0
    )
    expenses = (
        db.query(func.sum(func.abs(Transaction.amount_cents)))
        .filter(
            Transaction.user_id == user_id,
            Transaction.deleted_at.is_(None),
            Transaction.is_income.is_(False),
            func.strftime("%m", Transaction.date) == f"{month:02d}",
            func.strftime("%Y", Transaction.date) == str(year),
        )
        .scalar()
        or 0
    )
    return {"income_cents": income, "expense_cents": expenses, "month": month, "year": year}


def _get_recent_transactions(limit: int, db: Session, user_id: int) -> list:
    txns = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.deleted_at.is_(None),
        )
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": t.id,
            "date": str(t.date),
            "description": t.description,
            "amount_cents": t.amount_cents,
            "is_income": t.is_income,
            "category_id": t.category_id,
        }
        for t in txns
    ]


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def run_advisor(message: str, history: list, db: Session, user_id: int) -> str:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return "ANTHROPIC_API_KEY is not configured. Please set it in your .env file."

    try:
        client = anthropic.Anthropic(api_key=api_key)

        # Build message history
        messages = []
        for item in history:
            messages.append({"role": item["role"], "content": item["content"]})
        messages.append({"role": "user", "content": message})

        for _ in range(_MAX_ITERATIONS):
            response = client.messages.create(
                model=_MODEL,
                max_tokens=1024,
                system=_SYSTEM_PROMPT,
                tools=ADVISOR_TOOLS,
                messages=messages,
            )

            # Collect tool results
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue

                tool_name = block.name
                inp = block.input or {}

                if tool_name == "get_spending_by_category":
                    data = _get_spending_by_category(inp["month"], inp["year"], db, user_id)
                elif tool_name == "get_budget_status":
                    data = _get_budget_status(db, user_id)
                elif tool_name == "get_cash_flow":
                    data = _get_cash_flow(inp["month"], inp["year"], db, user_id)
                elif tool_name == "get_recent_transactions":
                    limit = int(inp.get("limit", 10))
                    data = _get_recent_transactions(limit, db, user_id)
                else:
                    data = {"error": f"Unknown tool: {tool_name}"}

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(data),
                })

            if response.stop_reason == "end_turn":
                # Extract text from final response
                for block in response.content:
                    if hasattr(block, "text"):
                        return block.text
                return ""

            if tool_results:
                messages.append({"role": "assistant", "content": response.content})
                messages.append({"role": "user", "content": tool_results})
            else:
                # No tool calls and not end_turn — extract any text and stop
                for block in response.content:
                    if hasattr(block, "text"):
                        return block.text
                break

        return "I was unable to generate a response. Please try again."

    except Exception as exc:
        return f"An error occurred while processing your request: {str(exc)}"
