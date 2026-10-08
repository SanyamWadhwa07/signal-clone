from collections import defaultdict
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import utcnow
from app.realtime import events
from app.realtime.publisher import EventPublisher
from app.repositories.conversations import ConversationRepository
from app.repositories.messages import MessageRepository
from app.repositories.receipts import ReceiptRepository
from app.repositories.users import UserRepository
from app.schemas.conversation import ReadStateOut
from app.services.access import require_member


class ReceiptService:
    """Delivery and read state: read markers, "delivered on connect", and status fan-out.

    A message's status is never stored; it is the aggregate of its per-recipient receipts, so this
    service only records facts (who delivered/read what) and tells senders what changed.
    """

    def __init__(
        self,
        session: AsyncSession,
        messages: MessageRepository,
        conversations: ConversationRepository,
        receipts: ReceiptRepository,
        users: UserRepository,
        publisher: EventPublisher,
    ) -> None:
        self.session = session
        self.messages = messages
        self.conversations = conversations
        self.receipts = receipts
        self.users = users
        self.publisher = publisher

    async def mark_read(self, user_id: int, conversation_id: int, up_to_id: int) -> ReadStateOut:
        member = await require_member(self.conversations, conversation_id, user_id)
        up_to = min(up_to_id, await self.messages.max_id(conversation_id))
        member.last_read_message_id = max(member.last_read_message_id, up_to)  # never moves back

        reader = await self.users.get(user_id)
        # A reader who disabled read receipts still gets "delivered" recorded, but never "read".
        share_read = reader is not None and reader.setting("read_receipts")
        affected = await self.receipts.mark_read(
            user_id, conversation_id, up_to, utcnow(), share_read=share_read
        )
        await self.session.commit()

        await self.publish_statuses(affected)
        read_state = ReadStateOut(
            conversation_id=conversation_id, last_read_message_id=member.last_read_message_id
        )
        # Other devices of the same user clear their unread badge too.
        await self.publisher.publish([user_id], events.CONVERSATION_READ, read_state)
        return read_state

    async def mark_all_delivered(self, user_id: int) -> None:
        """On (re)connect: everything sent while the user was offline is now delivered."""
        affected = await self.receipts.mark_delivered(user_id, utcnow())
        await self.session.commit()
        if affected:
            await self.publish_statuses(affected)

    async def publish_statuses(self, message_ids: list[int]) -> None:
        """Tell each affected sender the new aggregate status of their messages."""
        statuses = await self.receipts.statuses(message_ids)
        grouped: dict[tuple[int, int], list[dict[str, Any]]] = defaultdict(list)
        for message_id, sender_id, conversation_id in await self.messages.senders(message_ids):
            if sender_id is None:
                continue
            grouped[(sender_id, conversation_id)].append(
                {"id": message_id, "status": statuses[message_id]}
            )
        for (sender_id, conversation_id), updates in grouped.items():
            await self.publisher.publish(
                [sender_id],
                events.MESSAGE_STATUS,
                {"conversation_id": conversation_id, "updates": updates},
            )
