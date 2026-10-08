from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import ColumnElement, and_, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import ConversationMember, Message, MessageKind

_DETAIL_OPTIONS = (
    selectinload(Message.attachment),
    selectinload(Message.reactions),
    selectinload(Message.reply_to).selectinload(Message.attachment),
)


def not_expired(now: datetime) -> ColumnElement[bool]:
    return or_(Message.expires_at.is_(None), Message.expires_at > now)


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class MessageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add(self, message: Message) -> None:
        self.session.add(message)

    async def get(self, message_id: int) -> Message | None:
        return await self.session.get(Message, message_id)

    async def get_detailed(self, message_id: int) -> Message | None:
        stmt = select(Message).where(Message.id == message_id).options(*_DETAIL_OPTIONS)
        return await self.session.scalar(stmt.execution_options(populate_existing=True))

    async def get_many_detailed(self, message_ids: Sequence[int]) -> list[Message]:
        if not message_ids:
            return []
        stmt = (
            select(Message)
            .where(Message.id.in_(message_ids))
            .options(*_DETAIL_OPTIONS)
            .order_by(Message.id)
        )
        return list(await self.session.scalars(stmt))

    async def get_by_client_id(self, sender_id: int, client_id: str) -> Message | None:
        return await self.session.scalar(
            select(Message).where(Message.sender_id == sender_id, Message.client_id == client_id)
        )

    async def page(
        self,
        conversation_id: int,
        *,
        history_from_id: int,
        now: datetime,
        before_id: int | None,
        after_id: int | None,
        limit: int,
    ) -> tuple[list[Message], bool]:
        """Returns up to `limit` messages in ascending id order, plus whether more exist."""
        conditions = [
            Message.conversation_id == conversation_id,
            Message.id > history_from_id,
            not_expired(now),
        ]
        if after_id is not None:
            conditions.append(Message.id > after_id)
            order = Message.id.asc()
        else:
            if before_id is not None:
                conditions.append(Message.id < before_id)
            order = Message.id.desc()

        stmt = select(Message).where(*conditions).options(*_DETAIL_OPTIONS).order_by(order)
        rows = list(await self.session.scalars(stmt.limit(limit + 1)))
        has_more = len(rows) > limit
        rows = rows[:limit]
        if after_id is None:
            rows.reverse()
        return rows, has_more

    async def max_id(self, conversation_id: int) -> int:
        value = await self.session.scalar(
            select(func.max(Message.id)).where(Message.conversation_id == conversation_id)
        )
        return value or 0

    async def latest_ids(self, conversation_ids: list[int], now: datetime) -> dict[int, int]:
        if not conversation_ids:
            return {}
        stmt = (
            select(Message.conversation_id, func.max(Message.id))
            .where(Message.conversation_id.in_(conversation_ids), not_expired(now))
            .group_by(Message.conversation_id)
        )
        return {conv_id: msg_id for conv_id, msg_id in await self.session.execute(stmt)}

    async def unread_counts(self, user_id: int, now: datetime) -> dict[int, int]:
        """Unread = after my read marker and my join point, not mine, not system, not deleted."""
        stmt = (
            select(Message.conversation_id, func.count(Message.id))
            .join(
                ConversationMember,
                and_(
                    ConversationMember.conversation_id == Message.conversation_id,
                    ConversationMember.user_id == user_id,
                ),
            )
            .where(
                Message.id > ConversationMember.last_read_message_id,
                Message.id > ConversationMember.history_from_id,
                or_(Message.sender_id.is_(None), Message.sender_id != user_id),
                Message.kind != MessageKind.SYSTEM,
                Message.deleted_at.is_(None),
                not_expired(now),
            )
            .group_by(Message.conversation_id)
        )
        return {conv_id: count for conv_id, count in await self.session.execute(stmt)}

    async def expired(self, now: datetime) -> list[tuple[int, int]]:
        """(message_id, conversation_id) pairs whose disappearing timer has elapsed."""
        stmt = select(Message.id, Message.conversation_id).where(
            Message.expires_at.is_not(None), Message.expires_at <= now
        )
        return [(row[0], row[1]) for row in await self.session.execute(stmt)]

    async def delete_ids(self, message_ids: Sequence[int]) -> None:
        if message_ids:
            await self.session.execute(delete(Message).where(Message.id.in_(message_ids)))

    async def senders(self, message_ids: Sequence[int]) -> list[tuple[int, int | None, int]]:
        """(message_id, sender_id, conversation_id) for the given ids."""
        if not message_ids:
            return []
        stmt = select(Message.id, Message.sender_id, Message.conversation_id).where(
            Message.id.in_(message_ids)
        )
        return [(row[0], row[1], row[2]) for row in await self.session.execute(stmt)]

    async def search(self, user_id: int, term: str, now: datetime, limit: int) -> list[Message]:
        pattern = f"%{_escape_like(term)}%"
        stmt = (
            select(Message)
            .join(
                ConversationMember,
                and_(
                    ConversationMember.conversation_id == Message.conversation_id,
                    ConversationMember.user_id == user_id,
                ),
            )
            .where(
                Message.id > ConversationMember.history_from_id,
                Message.kind != MessageKind.SYSTEM,
                Message.deleted_at.is_(None),
                Message.body.ilike(pattern, escape="\\"),
                not_expired(now),
            )
            .options(*_DETAIL_OPTIONS)
            .order_by(Message.id.desc())
            .limit(limit)
        )
        return list(await self.session.scalars(stmt))
