from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import Party, User
from backend.schemas import APIResponse, PartyCreate, PartyOut, PartyUpdate

router = APIRouter(prefix="/parties", tags=["parties"])


@router.get("", response_model=APIResponse[List[PartyOut]])
def list_parties(
    party_type: Optional[str] = Query(None, description="Filter by party_type: vendor, customer, or both"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Party).filter(Party.user_id == current_user.id)
    if party_type is not None:
        q = q.filter(Party.party_type == party_type)
    parties = q.order_by(Party.name).all()
    return APIResponse(data=[PartyOut.model_validate(p) for p in parties])


@router.post("", response_model=APIResponse[PartyOut], status_code=201)
def create_party(
    payload: PartyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    party = Party(**payload.model_dump(), user_id=current_user.id)
    db.add(party)
    db.commit()
    db.refresh(party)
    return APIResponse(data=PartyOut.model_validate(party))


@router.get("/{party_id}", response_model=APIResponse[PartyOut])
def get_party(
    party_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    party = db.query(Party).filter(
        Party.id == party_id,
        Party.user_id == current_user.id,
    ).first()
    if not party:
        return APIResponse(error=f"Party {party_id} not found.")
    return APIResponse(data=PartyOut.model_validate(party))


@router.put("/{party_id}", response_model=APIResponse[PartyOut])
def update_party(
    party_id: int,
    payload: PartyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    party = db.query(Party).filter(
        Party.id == party_id,
        Party.user_id == current_user.id,
    ).first()
    if not party:
        return APIResponse(error=f"Party {party_id} not found.")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(party, field, value)
    party.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(party)
    return APIResponse(data=PartyOut.model_validate(party))


@router.delete("/{party_id}", response_model=APIResponse[None])
def delete_party(
    party_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    party = db.query(Party).filter(
        Party.id == party_id,
        Party.user_id == current_user.id,
    ).first()
    if not party:
        return APIResponse(error=f"Party {party_id} not found.")

    db.delete(party)
    db.commit()
    return APIResponse(data=None)
