from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import Settings
from app.core.errors import AppError

_ALGORITHM = "HS256"


@dataclass(frozen=True)
class TokenClaims:
    user_id: int
    jti: str


def create_access_token(settings: Settings, user_id: int, jti: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "jti": jti,
        "iat": now,
        "exp": now + timedelta(days=settings.jwt_ttl_days),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def decode_access_token(settings: Settings, token: str) -> TokenClaims:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[_ALGORITHM])
        return TokenClaims(user_id=int(payload["sub"]), jti=str(payload["jti"]))
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise AppError(
            401, "unauthorized", "Your session has expired. Please log in again."
        ) from exc
