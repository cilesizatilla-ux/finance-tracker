from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import User
from backend.schemas import APIResponse
from backend.services.analyzer import run_analysis

router = APIRouter(prefix="/analyze", tags=["analyze"])


@router.post("", response_model=APIResponse[dict])
def analyze_finances(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = run_analysis(db, user_id=current_user.id)
    return APIResponse(data=result)
