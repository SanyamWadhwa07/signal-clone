from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Conversation, ConversationMember, ConversationType, User


class ConversationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, conversation_id: int) -> Conversation | None:
        return await self.session.get(Conversation, conversation_id)

    async def get_by_direct_key(self, direct_key: str) -> Conversation | None:
        return await self.session.scalar(
            select(Conversation).where(Conversation.direct_key == direct_key)
        )

    def add(self, conversation: Conversation) -> None:
        self.session.add(conversation)

    def add_member(self, member: ConversationMember) -> None:
        self.session.add(member)

    async def delete_member(self, member: ConversationMember) -> None:
        await self.session.delete(member)

    async def get_member(self, conversation_id: int, user_id: int) -> ConversationMember | None:
        return await self.session.get(ConversationMember, (conversation_id, user_id))

    async def list_members(self, conversation_id: int) -> list[ConversationMember]:
        stmt = (
            select(ConversationMember)
            .join(User, User.id == ConversationMember.user_id)
            .where(ConversationMember.conversation_id == conversation_id)
            .order_by(
                ConversationMember.role, func.lower(func.coalesce(User.first_name, User.phone))
            )
        )
        return list(await self.session.scalars(stmt))

    async def member_ids(self, conversation_id: int) -> list[int]:
        stmt = select(ConversationMember.user_id).where(
            ConversationMember.conversation_id == conversation_id
        )
        return list(await self.session.scalars(stmt))

    async def members_of(self, conversation_ids: list[int]) -> list[ConversationMember]:
        if not conversation_ids:
            return []
        stmt = select(ConversationMember).where(
            ConversationMember.conversation_id.in_(conversation_ids)
        )
        return list(await self.session.scalars(stmt))

    async def memberships_for_user(
        self, user_id: int
    ) -> list[tuple[ConversationMember, Conversation]]:
        """The user's chat list: groups always; DMs once they have a message or the user opened them."""
        activity = func.coalesce(Conversation.last_message_at, Conversation.created_at)
        stmt = (
            select(ConversationMember, Conversation)
            .join(Conversation, Conversation.id == ConversationMember.conversation_id)
            .where(
                ConversationMember.user_id == user_id,
                or_(
                    Conversation.type == ConversationType.GROUP,
                    Conversation.last_message_at.is_not(None),
                    Conversation.created_by == user_id,
                ),
            )
            .order_by(activity.desc(), Conversation.id.desc())
        )
        return [(row[0], row[1]) for row in await self.session.execute(stmt)]
