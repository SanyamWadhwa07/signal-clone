import secrets
import zlib

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import AppError, bad_request
from app.core.security import TokenClaims, create_access_token, decode_access_token
from app.models import AuthSession, User
from app.models.base import utcnow
from app.repositories.users import AuthSessionRepository, UserRepository

# Signal's conversation color palette; the user's avatar color is derived from the phone number
# so it is stable across logins and devices.
AVATAR_COLORS = [
    "crimson",
    "vermilion",
    "burlap",
    "forest",
    "wintergreen",
    "teal",
    "blue",
    "indigo",
    "violet",
    "plum",
    "taupe",
    "steel",
]


def avatar_color_for(seed: str) -> str:
    return AVATAR_COLORS[zlib.crc32(seed.encode()) % len(AVATAR_COLORS)]


class AuthService:
    def __init__(
        self,
        session: AsyncSession,
        users: UserRepository,
        sessions: AuthSessionRepository,
        settings: Settings,
    ) -> None:
        self.session = session
        self.users = users
        self.sessions = sessions
        self.settings = settings

    def request_otp(self, phone: str) -> str:
        """Verification is mocked, so nothing is sent. The response is identical for every phone
        (registered or not), so this endpoint cannot be used to enumerate accounts."""
        return f"Demo mode: use code {self.settings.mock_otp}"

    async def verify_otp(
        self, phone: str, code: str, user_agent: str | None
    ) -> tuple[str, User, bool]:
        """Returns (token, user, is_new_user). Creates the account on first successful verification."""
        if not secrets.compare_digest(code, self.settings.mock_otp):
            raise bad_request("invalid_code", "That code is incorrect. Please try again.")

        user = await self.users.get_by_phone(phone)
        is_new = user is None
        if user is None:
            user = User(phone=phone, avatar_color=avatar_color_for(phone))
            self.users.add(user)
            await self.session.flush()

        jti = secrets.token_hex(16)
        self.sessions.add(
            AuthSession(user_id=user.id, jti=jti, user_agent=(user_agent or "")[:300] or None)
        )
        await self.session.commit()
        return create_access_token(self.settings, user.id, jti), user, is_new

    def decode(self, token: str) -> TokenClaims:
        return decode_access_token(self.settings, token)

    async def authenticate(self, token: str) -> User:
        """Resolve a bearer token to a user, rejecting revoked sessions."""
        claims = self.decode(token)
        if await self.sessions.get_active(claims.jti) is None:
            raise AppError(401, "unauthorized", "Your session has expired. Please log in again.")
        user = await self.users.get(claims.user_id)
        if user is None:
            raise AppError(401, "unauthorized", "Your session has expired. Please log in again.")
        return user

    async def logout(self, token: str) -> None:
        claims = self.decode(token)
        auth_session = await self.sessions.get_active(claims.jti)
        if auth_session is not None:
            auth_session.revoked_at = utcnow()
            await self.session.commit()
