from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow

DEFAULT_USER_SETTINGS: dict[str, Any] = {"read_receipts": True, "typing_indicators": True}


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(16), unique=True)  # E.164
    username: Mapped[str | None] = mapped_column(String(40), unique=True)
    # NULL first_name means onboarding (profile step) is not finished yet.
    first_name: Mapped[str | None] = mapped_column(String(26))
    last_name: Mapped[str | None] = mapped_column(String(26))
    about: Mapped[str | None] = mapped_column(String(140))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    avatar_color: Mapped[str] = mapped_column(String(20))
    settings: Mapped[dict[str, Any]] = mapped_column(default=lambda: dict(DEFAULT_USER_SETTINGS))
    last_seen_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    @property
    def display_name(self) -> str:
        full = " ".join(part for part in (self.first_name, self.last_name) if part)
        return full or self.phone

    def setting(self, key: str) -> bool:
        return bool({**DEFAULT_USER_SETTINGS, **(self.settings or {})}.get(key, True))


class AuthSession(Base):
    """One row per login. Logout revokes the row, which invalidates the JWT carrying its jti."""

    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    jti: Mapped[str] = mapped_column(String(64), unique=True)
    user_agent: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    revoked_at: Mapped[datetime | None]
