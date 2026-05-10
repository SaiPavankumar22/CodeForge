import hmac
import hashlib
import base64
import json
import time
from typing import Optional

from passlib.context import CryptContext
from core.config import settings

# Prefer pbkdf2_sha256 (no 72-byte password limit). Keep bcrypt for verifying any existing hashes.
_pwd = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return _pwd.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def create_admin_token() -> str:
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url(json.dumps({
        "sub": settings.ADMIN_EMAIL,
        "role": "admin",
        "iat": int(time.time()),
        "exp": int(time.time()) + 86400 * 7,  # 7 days
    }).encode())
    sig_input = f"{header}.{payload}".encode()
    sig = hmac.new(settings.APP_SECRET_KEY.encode(), sig_input, hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64url(sig)}"


def verify_admin_token(token: str) -> bool:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return False
        header, payload, sig = parts
        sig_input = f"{header}.{payload}".encode()
        expected_sig = hmac.new(settings.APP_SECRET_KEY.encode(), sig_input, hashlib.sha256).digest()
        if _b64url(expected_sig) != sig:
            return False
        # Decode payload
        padding = 4 - len(payload) % 4
        payload_data = json.loads(base64.urlsafe_b64decode(payload + "=" * padding))
        if payload_data.get("exp", 0) < time.time():
            return False
        return payload_data.get("role") == "admin"
    except Exception:
        return False


def authenticate_admin(email: str, password: str) -> bool:
    return email == settings.ADMIN_EMAIL and password == settings.ADMIN_PASSWORD


def create_user_token(user_id: str, username: str, email: str) -> str:
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url(json.dumps({
        "sub": user_id,
        "username": username,
        "email": email,
        "role": "user",
        "iat": int(time.time()),
        "exp": int(time.time()) + 86400 * 30,  # 30 days
    }).encode())
    sig_input = f"{header}.{payload}".encode()
    sig = hmac.new(settings.APP_SECRET_KEY.encode(), sig_input, hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64url(sig)}"


def verify_user_token(token: str) -> Optional[dict]:
    """Returns payload dict if valid user token, else None."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header, payload, sig = parts
        sig_input = f"{header}.{payload}".encode()
        expected_sig = hmac.new(settings.APP_SECRET_KEY.encode(), sig_input, hashlib.sha256).digest()
        if _b64url(expected_sig) != sig:
            return None
        padding = 4 - len(payload) % 4
        payload_data = json.loads(base64.urlsafe_b64decode(payload + "=" * padding))
        if payload_data.get("exp", 0) < time.time():
            return None
        if payload_data.get("role") != "user":
            return None
        return payload_data
    except Exception:
        return None
