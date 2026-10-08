from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Message, MessageReceipt
from app.schemas.message import MessageStatus


class ReceiptRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add_for_recipients(
        self,
        message_id: int,
        recipient_ids: Sequence[int],
        *,
        delivered_to: set[int],
        now: datetime,
    ) -> None:
        """Recipients with a live socket are delivered immediately; the rest on their next connect."""
        self.session.add_all(
            MessageReceipt(
                message_id=message_id,
                user_id=user_id,
                delivered_at=now if user_id in delivered_to else None,
            )
            for user_id in recipient_ids
        )

    async def mark_delivered(
        self, user_id: int, now: datetime, message_ids: Sequence[int] | None = None
    ) -> list[int]:
        """Mark pending deliveries for `user_id` (optionally only some messages). Returns affected ids."""
        conditions = [MessageReceipt.user_id == user_id, MessageReceipt.delivered_at.is_(None)]
        if message_ids is not None:
            if not message_ids:
                return []
            conditions.append(MessageReceipt.message_id.in_(message_ids))
        affected = list(
            await self.session.scalars(select(MessageReceipt.message_id).where(*conditions))
        )
        if affected:
            await self.session.execute(
                update(MessageReceipt)
                .where(MessageReceipt.user_id == user_id, MessageReceipt.message_id.in_(affected))
                .values(delivered_at=now)
            )
        return affected

    async def mark_read(
        self,
        user_id: int,
        conversation_id: int,
        up_to_id: int,
        now: datetime,
        *,
        share_read: bool,
    ) -> list[int]:
        """Mark messages up to `up_to_id` as read by `user_id`.

        When the reader disabled read receipts, only delivery is recorded so senders never see "read".
        """
        in_conversation = select(Message.id).where(
            Message.conversation_id == conversation_id, Message.id <= up_to_id
        )
        pending = (
            MessageReceipt.read_at.is_(None)
            if share_read
            else MessageReceipt.delivered_at.is_(None)
        )
        affected = list(
            await self.session.scalars(
                select(MessageReceipt.message_id).where(
                    MessageReceipt.user_id == user_id,
                    MessageReceipt.message_id.in_(in_conversation),
                    pending,
                )
            )
        )
        if affected:
            values: dict[str, object] = {
                "delivered_at": func.coalesce(MessageReceipt.delivered_at, now)
            }
            if share_read:
                values["read_at"] = now
            await self.session.execute(
                update(MessageReceipt)
                .where(MessageReceipt.user_id == user_id, MessageReceipt.message_id.in_(affected))
                .values(**values)
            )
        return affected

    async def delete_unread_for_member(self, conversation_id: int, user_id: int) -> list[int]:
        """When a member leaves, drop their unread receipts so group statuses can still complete."""
        in_conversation = select(Message.id).where(Message.conversation_id == conversation_id)
        conditions = (
            MessageReceipt.user_id == user_id,
            MessageReceipt.message_id.in_(in_conversation),
            MessageReceipt.read_at.is_(None),
        )
        affected = list(
            await self.session.scalars(select(MessageReceipt.message_id).where(*conditions))
        )
        if affected:
            await self.session.execute(delete(MessageReceipt).where(*conditions))
        return affected

    async def statuses(self, message_ids: Sequence[int]) -> dict[int, MessageStatus]:
        """Aggregate status per message: read if all recipients read, delivered if all delivered.

        Messages without receipts (Note to Self, or every recipient left) count as read.
        """
        result: dict[int, MessageStatus] = {message_id: "read" for message_id in message_ids}
        if not message_ids:
            return result
        stmt = (
            select(
                MessageReceipt.message_id,
                func.count(),
                func.count(MessageReceipt.delivered_at),
                func.count(MessageReceipt.read_at),
            )
            .where(MessageReceipt.message_id.in_(message_ids))
            .group_by(MessageReceipt.message_id)
        )
        for message_id, total, delivered, read in await self.session.execute(stmt):
            if read == total:
                result[message_id] = "read"
            elif delivered == total:
                result[message_id] = "delivered"
            else:
                result[message_id] = "sent"
        return result
