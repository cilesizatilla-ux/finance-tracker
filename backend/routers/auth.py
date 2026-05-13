import os
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.auth import create_access_token, hash_password, verify_password
from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import User
from backend.schemas import APIResponse, GoogleAuth, Token, UserCreate, UserLogin, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=APIResponse[Token], status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email.lower()).first():
        return APIResponse(error="An account with this email already exists.")

    user = User(
        email=payload.email.lower(),
        name=payload.name or payload.email.split("@")[0],
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email)
    return APIResponse(data=Token(access_token=token))


@router.post("/login", response_model=APIResponse[Token])
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        return APIResponse(error="Invalid email or password.")

    token = create_access_token(user.id, user.email)
    return APIResponse(data=Token(access_token=token))


@router.post("/google", response_model=APIResponse[Token])
def google_login(payload: GoogleAuth, db: Session = Depends(get_db)):
    google_client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    if not google_client_id:
        raise HTTPException(status_code=501, detail="Google OAuth is not configured on this server.")

    # Verify token with Google
    resp = httpx.get(
        "https://oauth2.googleapis.com/tokeninfo",
        params={"id_token": payload.credential},
        timeout=10,
    )
    if resp.status_code != 200:
        return APIResponse(error="Invalid Google token.")

    info = resp.json()
    if info.get("aud") != google_client_id:
        return APIResponse(error="Google token audience mismatch.")

    email = info.get("email", "").lower()
    google_id = info.get("sub", "")
    name = info.get("name") or info.get("given_name") or email.split("@")[0]
    avatar_url = info.get("picture")

    user = db.query(User).filter(User.email == email).first()
    if user:
        # Update Google info if not set
        if not user.google_id:
            user.google_id = google_id
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
        user.updated_at = datetime.utcnow()
        db.commit()
    else:
        user = User(email=email, name=name, google_id=google_id, avatar_url=avatar_url)
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token(user.id, user.email)
    return APIResponse(data=Token(access_token=token))


@router.get("/me", response_model=APIResponse[UserOut])
def me(current_user: User = Depends(get_current_user)):
    return APIResponse(data=UserOut.model_validate(current_user))
