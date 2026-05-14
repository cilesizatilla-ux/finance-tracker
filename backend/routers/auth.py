import os
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from backend.auth import create_access_token, hash_password, verify_password
from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import User
from backend.schemas import APIResponse, GoogleAuth, Token, UserCreate, UserLogin, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _google_callback_url() -> str:
    origin = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")[0].strip()
    backend_base = "http://localhost:8001" if "localhost" in origin else origin
    return f"{backend_base}/api/v1/auth/google/callback"


def _frontend_url() -> str:
    return os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")[0].strip()


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


@router.get("/google/redirect")
def google_redirect():
    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    if not client_id:
        raise HTTPException(status_code=501, detail="Google OAuth is not configured.")
    params = urlencode({
        "client_id": client_id,
        "redirect_uri": _google_callback_url(),
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
    })
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")


@router.get("/google/callback")
def google_callback(
    code: str = Query(...),
    error: str = Query(None),
    db: Session = Depends(get_db),
):
    if error:
        return RedirectResponse(f"{_frontend_url()}/login?error=google_denied")

    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        return RedirectResponse(f"{_frontend_url()}/login?error=not_configured")

    # Exchange authorization code for tokens
    token_resp = httpx.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": _google_callback_url(),
            "grant_type": "authorization_code",
        },
        timeout=10,
    )
    if token_resp.status_code != 200:
        return RedirectResponse(f"{_frontend_url()}/login?error=token_exchange_failed")

    id_token_str = token_resp.json().get("id_token", "")

    # Verify the ID token
    info_resp = httpx.get(
        "https://oauth2.googleapis.com/tokeninfo",
        params={"id_token": id_token_str},
        timeout=10,
    )
    if info_resp.status_code != 200:
        return RedirectResponse(f"{_frontend_url()}/login?error=invalid_token")

    info = info_resp.json()
    if info.get("aud") != client_id:
        return RedirectResponse(f"{_frontend_url()}/login?error=audience_mismatch")
    if not info.get("email_verified"):
        return RedirectResponse(f"{_frontend_url()}/login?error=email_not_verified")

    email = info.get("email", "").lower()
    google_id = info.get("sub", "")
    name = info.get("name") or info.get("given_name") or email.split("@")[0]
    avatar_url = info.get("picture")

    user = db.query(User).filter(User.email == email).first()
    if user:
        if not user.google_id:
            user.google_id = google_id
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
        user.updated_at = datetime.now(timezone.utc)
        db.commit()
    else:
        user = User(email=email, name=name, google_id=google_id, avatar_url=avatar_url)
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token = create_access_token(user.id, user.email)
    return RedirectResponse(f"{_frontend_url()}/auth/callback#{access_token}")


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
    if not info.get("email_verified"):
        return APIResponse(error="Google account email is not verified.")

    email = info.get("email", "").lower()
    google_id = info.get("sub", "")
    name = info.get("name") or info.get("given_name") or email.split("@")[0]
    avatar_url = info.get("picture")

    user = db.query(User).filter(User.email == email).first()
    if user:
        if not user.google_id:
            user.google_id = google_id
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
        user.updated_at = datetime.now(timezone.utc)
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


from pydantic import BaseModel as PydanticBase
from typing import Optional as Opt


class ProfileUpdate(PydanticBase):
    name: Opt[str] = None
    country: Opt[str] = None
    currency: Opt[str] = None
    income_bracket: Opt[str] = None
    financial_goal: Opt[str] = None
    occupation: Opt[str] = None


@router.get("/profile")
def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from backend.models import UserProfile
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return APIResponse(data={
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "avatar_url": current_user.avatar_url,
        "country": profile.country,
        "currency": profile.currency,
        "income_bracket": profile.income_bracket,
        "financial_goal": profile.financial_goal,
        "occupation": profile.occupation,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    })


@router.patch("/profile")
def update_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from backend.models import UserProfile
    from datetime import datetime
    if payload.name:
        current_user.name = payload.name
        current_user.updated_at = datetime.utcnow()
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
    for field in ("country", "currency", "income_bracket", "financial_goal", "occupation"):
        val = getattr(payload, field)
        if val is not None:
            setattr(profile, field, val)
    profile.updated_at = datetime.utcnow()
    db.commit()
    return APIResponse(data={"message": "Profile updated"})


@router.get("/notifications")
def list_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from backend.models import Notification, UserNotificationRead
    notifs = db.query(Notification).order_by(Notification.created_at.desc()).limit(20).all()
    read_ids = {r.notification_id for r in db.query(UserNotificationRead).filter(
        UserNotificationRead.user_id == current_user.id
    ).all()}
    return APIResponse(data=[{
        "id": n.id,
        "title": n.title,
        "body": n.body,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "is_read": n.id in read_ids,
    } for n in notifs])


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from backend.models import UserNotificationRead
    existing = db.query(UserNotificationRead).filter(
        UserNotificationRead.user_id == current_user.id,
        UserNotificationRead.notification_id == notification_id,
    ).first()
    if not existing:
        db.add(UserNotificationRead(user_id=current_user.id, notification_id=notification_id))
        db.commit()
    return APIResponse(data={"message": "marked read"})
