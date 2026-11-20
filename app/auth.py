from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.security import verify_password
from app.database import get_user_by_email

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
async def login(data: LoginRequest):
    email = data.email.strip().lower()
    user = get_user_by_email(email)

    if user is None or user["password_hash"] is None:
        raise HTTPException(
            status_code=401,
            detail="Неверная почта или пароль",
        )

    password_matches = verify_password(data.password, user["password_hash"])

    if not password_matches:
        raise HTTPException(
            status_code=401,
            detail="Неверная почта или пароль",
        )

    return {
        "id": user["id"],
        "email": user["email"],
        "role": user["role"],
    }
