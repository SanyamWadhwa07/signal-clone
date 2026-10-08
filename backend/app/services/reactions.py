from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import bad_request, not_found
from app.models import MessageKind
from app.realtime import events
from app.realtime.publisher import EventPublisher
from app.repositories.conversations import ConversationRepository
from app.repositories.messages import MessageRepository
from app.repositories.reactions import ReactionRepository
from app.schemas.message import ReactionOut
from app.services.access import require_member


class ReactionService:
    """One emoji reaction per user per message (Signal semantics)."""

    def __init__(
        self,
        session: AsyncSession,
        messages: MessageRepository,
        conversations: ConversationRepository,
        reactions: ReactionRepository,
        publisher: EventPublisher,
    ) -> None:
        self.session = session
        self.messages = messages
        self.conversations = conversations
        self.reactions = reactions
        self.publisher = publisher

    async def react(self, user_id: int, message_id: int, emoji: str | None) -> None:
        """Set (emoji) or clear (None) the user's reaction on a message."""
        message = await self.messages.get(message_id)
        if message is None:
            raise not_found("Message not found.")
        member = await require_member(self.conversations, message.conversation_id, user_id)
        if (
            message.kind == MessageKind.SYSTEM
            or message.is_deleted
            or message.id <= member.history_from_id
        ):
            raise bad_request("not_reactable", "You can't react to this message.")

        if emoji is None:
            await self.reactions.delete(message.id, user_id)
        else:
            if emoji.isascii():
                raise bad_request("invalid_emoji", "Reactions must be emoji.")
            await self.reactions.upsert(message.id, user_id, emoji)
        await self.session.commit()

        current = await self.reactions.list_for(message.id)
        member_ids = await self.conversations.member_ids(message.conversation_id)
        await self.publisher.publish(
            member_ids,
            events.REACTION_UPDATED,
            {
                "conversation_id": message.conversation_id,
                "message_id": message.id,
                "reactions": [ReactionOut(user_id=r.user_id, emoji=r.emoji) for r in current],
            },
        )
