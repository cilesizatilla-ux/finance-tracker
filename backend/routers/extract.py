import os
import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import User
from backend.schemas import APIResponse

router = APIRouter(prefix="/receipts", tags=["receipts"])


@router.post("/extract", response_model=APIResponse[dict])
async def extract_receipt_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/jpg"}
    media_type = file.content_type or "image/jpeg"
    filename_lower = (file.filename or "").lower()
    if media_type not in allowed and not filename_lower.endswith((".jpg", ".jpeg", ".png", ".gif", ".webp")):
        return APIResponse(error="Only image files (JPEG, PNG, GIF, WebP) are supported.")

    # Normalize media_type
    if "jpg" in media_type or "jpeg" in media_type:
        media_type = "image/jpeg"
    elif "png" in media_type:
        media_type = "image/png"
    elif "gif" in media_type:
        media_type = "image/gif"
    elif "webp" in media_type:
        media_type = "image/webp"

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        return APIResponse(error="File too large. Maximum size is 5MB.")

    # Save file
    user_dir = f"uploads/receipts/{current_user.id}"
    os.makedirs(user_dir, exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = f"{user_dir}/{filename}"
    with open(filepath, "wb") as f:
        f.write(content)

    receipt_path = f"/uploads/receipts/{current_user.id}/{filename}"

    # Extract with AI
    from backend.services.extractor import extract_receipt
    try:
        extracted = extract_receipt(content, media_type)
    except Exception as e:
        extracted = {"error": str(e)}

    extracted["receipt_path"] = receipt_path
    return APIResponse(data=extracted)
