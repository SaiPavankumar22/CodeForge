from fastapi import APIRouter, HTTPException
from models.schemas import AdminLoginRequest, AdminLoginResponse
from services.auth_service import authenticate_admin, create_admin_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/admin/login", response_model=AdminLoginResponse)
async def admin_login(request: AdminLoginRequest):
    """Admin login endpoint."""
    if authenticate_admin(request.email, request.password):
        token = create_admin_token()
        return AdminLoginResponse(success=True, token=token, message="Login successful")
    raise HTTPException(status_code=401, detail="Invalid credentials")


@router.get("/admin/verify")
async def verify_token(authorization: str = None):
    """Quick token validity check."""
    from services.auth_service import verify_admin_token
    from fastapi import Header
    if not authorization:
        return {"valid": False}
    token = authorization.replace("Bearer ", "")
    return {"valid": verify_admin_token(token)}
