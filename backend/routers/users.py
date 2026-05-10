from fastapi import APIRouter, HTTPException, Header
from typing import Optional

from models.schemas import UserRegister, UserLogin, UserLoginResponse, UserResponse
from services import user_service
from services.auth_service import create_user_token, verify_user_token

router = APIRouter(prefix="/api/users", tags=["users"])


def _require_user(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = verify_user_token(authorization[7:])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


def _build_response(user: dict, token: str, message: str) -> UserLoginResponse:
    return UserLoginResponse(
        success=True,
        token=token,
        message=message,
        user=UserResponse(
            id=str(user["_id"]),
            username=user["username"],
            email=user["email"],
            created_at=user["created_at"],
        ),
    )


@router.post("/register", response_model=UserLoginResponse)
async def register(data: UserRegister):
    try:
        user = await user_service.register_user(data.username, data.email, data.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    token = create_user_token(str(user["_id"]), user["username"], user["email"])
    return _build_response(user, token, "Registration successful")


@router.post("/login", response_model=UserLoginResponse)
async def login(data: UserLogin):
    user = await user_service.login_user(data.email, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_user_token(str(user["_id"]), user["username"], user["email"])
    return _build_response(user, token, "Login successful")


@router.get("/me", response_model=UserResponse)
async def get_me(authorization: Optional[str] = Header(None)):
    payload = _require_user(authorization)
    user = await user_service.get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(
        id=str(user["_id"]),
        username=user["username"],
        email=user["email"],
        created_at=user["created_at"],
    )


@router.get("/progress")
async def get_progress(authorization: Optional[str] = Header(None)):
    payload = _require_user(authorization)
    solved = await user_service.get_user_solved_ids(payload["sub"])
    return {"solved": solved, "count": len(solved)}
