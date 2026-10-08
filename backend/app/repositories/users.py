from collections.abc import Iterable
from datetime import datetime

from sqlalchemy import select, union, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models import AuthSession, Contact, ConversationMember, User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, user_id: int) -> User | None:
        return await self.session.get(User, user_id)

    async def get_by_phone(self, phone: str) -> User | None:
        return await self.session.scalar(select(User).where(User.phone == phone))

    async def get_by_username(self, username: str) -> User | None:
        return await self.session.scalar(select(User).where(User.username == username))

    async def list_by_ids(self, user_ids: set[int]) -> list[User]:
        if not user_ids:
            return []
        return list(await self.session.scalars(select(User).where(User.id.in_(user_ids))))

    async def list_by_phones(self, phones: Iterable[str]) -> list[User]:
        phones = list(phones)
        if not phones:
            return []
        return list(await self.session.scalars(select(User).where(User.phone.in_(phones))))

    def add(self, user: User) -> None:
        self.session.add(user)

    async def audience_ids(self, user_id: int) -> set[int]:
        """Users who should see this user's presence/profile changes:
        anyone sharing a conversation with them, plus anyone who saved them as a contact."""
        me, other = aliased(ConversationMember), aliased(ConversationMember)
        co_members = (
            select(other.user_id)
            .join(me, me.conversation_id == other.conversation_id)
            .where(me.user_id == user_id, other.user_id != user_id)
        )
        saved_me = select(Contact.owner_id).where(Contact.contact_id == user_id)
        rows = await self.session.scalars(union(co_members, saved_me))
        return set(rows)

    async def set_last_seen(self, user_id: int, when: datetime) -> None:
        await self.session.execute(update(User).where(User.id == user_id).values(last_seen_at=when))


class AuthSessionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add(self, auth_session: AuthSession) -> None:
        self.session.add(auth_session)

    async def get_active(self, jti: str) -> AuthSession | None:
        return await self.session.scalar(
            select(AuthSession).where(AuthSession.jti == jti, AuthSession.revoked_at.is_(None))
        )
