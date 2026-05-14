from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import SavingsGoal, GoalContribution
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

router = APIRouter(prefix="/goals", tags=["goals"])


class GoalCreate(BaseModel):
    name: str
    description: Optional[str] = None
    target_amount_cents: int
    deadline: Optional[date] = None
    icon: str = "🎯"
    color: str = "#6366f1"

class GoalUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    target_amount_cents: Optional[int] = None
    current_amount_cents: Optional[int] = None
    deadline: Optional[date] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    status: Optional[str] = None

class ContributePayload(BaseModel):
    amount_cents: int
    note: Optional[str] = None


def _ser(g: SavingsGoal) -> dict:
    pct = round(g.current_amount_cents / g.target_amount_cents * 100, 1) if g.target_amount_cents else 0
    return {
        "id": g.id,
        "name": g.name,
        "description": g.description,
        "target_amount_cents": g.target_amount_cents,
        "current_amount_cents": g.current_amount_cents,
        "pct": min(pct, 100),
        "deadline": g.deadline.isoformat() if g.deadline else None,
        "icon": g.icon,
        "color": g.color,
        "status": g.status,
        "created_at": g.created_at.isoformat() if g.created_at else None,
        "contributions_count": len(g.contributions) if g.contributions else 0,
    }


@router.get("")
def list_goals(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    goals = (
        db.query(SavingsGoal)
        .filter(SavingsGoal.user_id == current_user.id)
        .order_by(SavingsGoal.created_at.desc())
        .all()
    )
    return [_ser(g) for g in goals]


@router.post("")
def create_goal(payload: GoalCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    g = SavingsGoal(user_id=current_user.id, **payload.dict())
    db.add(g)
    db.commit()
    db.refresh(g)
    return _ser(g)


@router.put("/{goal_id}")
def update_goal(goal_id: int, payload: GoalUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    g = db.query(SavingsGoal).filter(SavingsGoal.id == goal_id, SavingsGoal.user_id == current_user.id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Goal not found")
    for field, val in payload.dict(exclude_unset=True).items():
        setattr(g, field, val)
    # Auto-complete if reached target
    if g.current_amount_cents >= g.target_amount_cents and g.status == "active":
        g.status = "completed"
    db.commit()
    db.refresh(g)
    return _ser(g)


@router.delete("/{goal_id}")
def delete_goal(goal_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    g = db.query(SavingsGoal).filter(SavingsGoal.id == goal_id, SavingsGoal.user_id == current_user.id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Goal not found")
    db.delete(g)
    db.commit()
    return {"ok": True}


@router.post("/{goal_id}/contribute")
def contribute(goal_id: int, payload: ContributePayload, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    g = db.query(SavingsGoal).filter(SavingsGoal.id == goal_id, SavingsGoal.user_id == current_user.id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Goal not found")
    if g.status not in ("active", "paused"):
        raise HTTPException(status_code=400, detail="Cannot contribute to a completed or cancelled goal")
    c = GoalContribution(goal_id=goal_id, amount_cents=payload.amount_cents, note=payload.note)
    db.add(c)
    g.current_amount_cents += payload.amount_cents
    if g.current_amount_cents >= g.target_amount_cents:
        g.status = "completed"
    db.commit()
    db.refresh(g)
    return _ser(g)


@router.get("/{goal_id}/contributions")
def list_contributions(goal_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    g = db.query(SavingsGoal).filter(SavingsGoal.id == goal_id, SavingsGoal.user_id == current_user.id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Goal not found")
    contribs = db.query(GoalContribution).filter(GoalContribution.goal_id == goal_id).order_by(desc(GoalContribution.contributed_at)).all()
    return [
        {
            "id": c.id,
            "amount_cents": c.amount_cents,
            "note": c.note,
            "contributed_at": c.contributed_at.isoformat() if c.contributed_at else None,
        }
        for c in contribs
    ]
