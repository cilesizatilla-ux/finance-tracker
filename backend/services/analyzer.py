import os
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models import Category, Transaction
from backend.services.agent_tools import ADVISOR_TOOLS


def _get_financial_snapshot(db: Session, user_id: int) -> dict:
    from sqlalchemy import or_
    now = datetime.utcnow()
    month, year = now.month, now.year

    def strfmt(m, y): return f"{m:02d}", str(y)

    mm, yy = strfmt(month, year)
    income_this_month = db.query(func.sum(Transaction.amount_cents)).filter(
        Transaction.user_id == user_id,
        Transaction.deleted_at.is_(None),
        Transaction.is_income.is_(True),
        func.strftime("%m", Transaction.date) == mm,
        func.strftime("%Y", Transaction.date) == yy,
    ).scalar() or 0

    expense_this_month = db.query(func.sum(func.abs(Transaction.amount_cents))).filter(
        Transaction.user_id == user_id,
        Transaction.deleted_at.is_(None),
        Transaction.is_income.is_(False),
        func.strftime("%m", Transaction.date) == mm,
        func.strftime("%Y", Transaction.date) == yy,
    ).scalar() or 0

    categories = db.query(Category).filter(
        or_(Category.user_id.is_(None), Category.user_id == user_id)
    ).all()
    cat_spending = []
    for cat in categories:
        spent = db.query(func.sum(func.abs(Transaction.amount_cents))).filter(
            Transaction.category_id == cat.id,
            Transaction.user_id == user_id,
            Transaction.deleted_at.is_(None),
            Transaction.is_income.is_(False),
            func.strftime("%m", Transaction.date) == mm,
            func.strftime("%Y", Transaction.date) == yy,
        ).scalar() or 0
        cat_spending.append({
            "category": cat.name,
            "budget_cents": cat.budget_cents,
            "spent_cents": spent,
            "color": cat.color,
        })

    monthly_net = []
    for i in range(3):
        total = (now.year * 12 + now.month - 1) - i
        y, m = total // 12, total % 12 + 1
        ms, ys = strfmt(m, y)
        inc = db.query(func.sum(Transaction.amount_cents)).filter(
            Transaction.user_id == user_id,
            Transaction.deleted_at.is_(None), Transaction.is_income.is_(True),
            func.strftime("%m", Transaction.date) == ms,
            func.strftime("%Y", Transaction.date) == ys,
        ).scalar() or 0
        exp = db.query(func.sum(func.abs(Transaction.amount_cents))).filter(
            Transaction.user_id == user_id,
            Transaction.deleted_at.is_(None), Transaction.is_income.is_(False),
            func.strftime("%m", Transaction.date) == ms,
            func.strftime("%Y", Transaction.date) == ys,
        ).scalar() or 0
        monthly_net.append({"month": m, "year": y, "income_cents": inc, "expense_cents": exp, "net_cents": inc - exp})

    total_transactions = db.query(func.count(Transaction.id)).filter(
        Transaction.user_id == user_id,
        Transaction.deleted_at.is_(None),
    ).scalar() or 0

    anomalies = db.query(func.count(Transaction.id)).filter(
        Transaction.user_id == user_id,
        Transaction.is_anomaly.is_(True),
        Transaction.deleted_at.is_(None),
    ).scalar() or 0

    return {
        "current_month": {"income_cents": income_this_month, "expense_cents": expense_this_month,
                          "net_cents": income_this_month - expense_this_month},
        "category_spending": cat_spending,
        "monthly_trend": monthly_net,
        "total_transactions": total_transactions,
        "anomaly_count": anomalies,
    }


def run_analysis(db: Session, user_id: int) -> dict:
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    snapshot = _get_financial_snapshot(db, user_id)

    if not api_key or api_key == "sk-ant-your-key-here":
        return _mock_analysis(snapshot)

    try:
        from anthropic import Anthropic
        client = Anthropic(api_key=api_key)

        system = (
            "You are a personal finance analyst. You analyze financial data and return a structured JSON report. "
            "Always respond with valid JSON only — no markdown, no extra text."
        )

        prompt = f"""Analyze this financial snapshot and return a JSON object with this exact structure:
{{
  "health_score": <integer 0-100>,
  "grade": "<A+|A|B+|B|C+|C|D|F>",
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "warnings": ["<warning 1>", "<warning 2>"],
  "recommendations": [
    {{"title": "<short title>", "detail": "<1-2 sentence recommendation>", "priority": "<high|medium|low>"}}
  ],
  "biggest_expense_category": "<name>",
  "savings_rate_pct": <number or null if no income>
}}

Financial data:
{snapshot}

Rules:
- health_score: 80-100 = great, 60-79 = good, 40-59 = needs attention, <40 = poor
- If there are no transactions, give a score of 50 with encouragement to start tracking
- savings_rate_pct = ((income - expense) / income * 100) for current month, null if income is 0
- Keep all text concise and actionable
"""

        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )

        import json
        text = response.content[0].text.strip()
        result = json.loads(text)
        result["snapshot"] = snapshot
        return result

    except Exception as e:
        fallback = _mock_analysis(snapshot)
        fallback["error"] = str(e)
        return fallback


def _mock_analysis(snapshot: dict) -> dict:
    inc = snapshot["current_month"]["income_cents"]
    exp = snapshot["current_month"]["expense_cents"]
    net = inc - exp
    savings_rate = round((net / inc * 100), 1) if inc > 0 else None
    score = 50 if snapshot["total_transactions"] == 0 else (75 if net >= 0 else 45)

    return {
        "health_score": score,
        "grade": "B" if score >= 70 else ("C" if score >= 50 else "D"),
        "summary": "Add your ANTHROPIC_API_KEY to .env to unlock AI-powered financial analysis. "
                   "Your data is ready — connect the API to get personalized insights.",
        "strengths": ["Data is being tracked correctly", "Categories are set up"],
        "warnings": ["AI analysis requires a valid Anthropic API key"],
        "recommendations": [
            {"title": "Connect AI Analysis", "detail": "Add your ANTHROPIC_API_KEY to the .env file and restart the backend.", "priority": "high"}
        ],
        "biggest_expense_category": next(
            (c["category"] for c in sorted(snapshot["category_spending"], key=lambda x: -x["spent_cents"])), "—"
        ),
        "savings_rate_pct": savings_rate,
        "snapshot": snapshot,
    }
