import os
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import AdminUser

ALGORITHM = "HS256"
ADMIN_TOKEN_EXPIRE_HOURS = 8

_SECRET_KEY = os.getenv("JWT_SECRET")
if not _SECRET_KEY:
    raise RuntimeError("JWT_SECRET environment variable must be set")

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Separate oauth2 scheme name to avoid conflict with user JWT scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/admin/auth/login", scheme_name="admin-bearer", auto_error=False)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


def hash_password(password: str) -> str:
    return pwd_ctx.hash(password)


def create_admin_token(admin_id: int, username: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ADMIN_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": username,
        "admin_id": admin_id,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, _SECRET_KEY, algorithm=ALGORITHM)


def decode_admin_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, _SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired admin token",
        )


def get_current_admin(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> AdminUser:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required",
        )
    payload = decode_admin_token(token)
    admin_id = payload.get("admin_id")
    if not admin_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token payload",
        )
    admin = db.query(AdminUser).filter(AdminUser.id == admin_id).first()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin not found",
        )
    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin account is inactive",
        )
    return admin


def require_super_admin(admin: AdminUser = Depends(get_current_admin)) -> AdminUser:
    if admin.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required",
        )
    return admin
