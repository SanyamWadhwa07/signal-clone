from app.core.errors import not_found
from app.models import ConversationMember
from app.repositories.conversations import ConversationRepository


async def require_member(
    conversations: ConversationRepository, conversation_id: int, user_id: int
) -> ConversationMember:
    """Membership gate for every conversation-scoped operation.

    Non-members get 404 rather than 403 so conversation ids can't be probed for existence.
    """
    member = await conversations.get_member(conversation_id, user_id)
    if member is None:
        raise not_found("Conversation not found.")
    return member
