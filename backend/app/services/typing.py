from app.realtime import events
from app.realtime.publisher import EventPublisher
from app.repositories.conversations import ConversationRepository
from app.repositories.users import UserRepository


class TypingService:
    """Relays "is typing" signals to the other members of a conversation. Nothing is persisted."""

    def __init__(
        self,
        users: UserRepository,
        conversations: ConversationRepository,
        publisher: EventPublisher,
    ) -> None:
        self.users = users
        self.conversations = conversations
        self.publisher = publisher

    async def relay(self, user_id: int, conversation_id: int, is_typing: bool) -> None:
        user = await self.users.get(user_id)
        if user is None or not user.setting("typing_indicators"):
            return  # Signal semantics: hide your typing and you don't send it either
        if await self.conversations.get_member(conversation_id, user_id) is None:
            return
        others = [
            uid for uid in await self.conversations.member_ids(conversation_id) if uid != user_id
        ]
        await self.publisher.publish(
            others,
            events.TYPING,
            {"conversation_id": conversation_id, "user_id": user_id, "is_typing": is_typing},
        )
