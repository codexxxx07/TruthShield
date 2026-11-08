"""FastAPI dependencies: authentication and rate limiting."""
import threading
import time
from collections import defaultdict, deque
from datetime import timedelta

import jwt
from fastapi import Depends, Header, HTTPException, Request

from .config import settings
from .db import get_db, public
from .util import utcnow

ALGORITHM = "HS256"
_rate_lock = threading.Lock()
_hits: dict = defaultdict(deque)


def issue_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": utcnow() + timedelta(hours=settings.jwt_ttl_hours)}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def public_user(user: dict) -> dict:
    return {key: value for key, value in public(user).items() if key not in ("password", "createdAt")}


def optional_user(authorization: str | None = Header(default=None)) -> dict | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        payload = jwt.decode(authorization[7:], settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    return get_db().users.find_one({"id": payload.get("sub")})


def current_user(user: dict | None = Depends(optional_user)) -> dict:
    if user is None:
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    return user


def _limit(key: str, per_minute: int) -> None:
    now = time.monotonic()
    with _rate_lock:
        window = _hits[key]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= per_minute:
            raise HTTPException(status_code=429, detail="Too many requests. Please wait a minute and try again.")
        window.append(now)


def rate_limit(request: Request) -> None:
    _limit(f"scan:{request.client.host if request.client else 'unknown'}", settings.rate_limit_per_minute)


def auth_rate_limit(request: Request) -> None:
    _limit(f"auth:{request.client.host if request.client else 'unknown'}", 10)
