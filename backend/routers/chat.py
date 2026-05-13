from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import User
from backend.schemas import APIResponse, ChatRequest
from backend.services import advisor

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=APIResponse[dict])
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    history = [msg.model_dump() for msg in payload.history]
    reply = advisor.run_advisor(payload.message, history, db, user_id=current_user.id)
    return APIResponse(data={"reply": reply})
