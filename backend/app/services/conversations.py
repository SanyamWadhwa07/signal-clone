from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import bad_request, forbidden, not_found
from app.models import (
    Conversation,
    ConversationMember,
    ConversationType,
    User,
)
from app.models.base import utcnow
from app.realtime import events
from app.realtime.publisher import EventPublisher, PresenceTracker
from app.repositories.conversations import ConversationRepository
from app.repositories.messages import MessageRepository
from app.repositories.receipts import ReceiptRepository
from app.repositories.users import UserRepository
from app.schemas.conversation import ConversationOut, UpdateConversationRequest
from app.schemas.user import UserPublic
from app.services.access import require_member
from app.services.messages import MessageService
from app.services.presenters import message_out, user_public

Membership = tuple[ConversationMember, Conversation]


def direct_key(user_a: int, user_b: int) -> str:
    low, high = sorted((user_a, user_b))
    return f"{low}:{high}"


class ConversationService:
    def __init__(
        self,
        session: AsyncSession,
        conversations: ConversationRepository,
        messages: MessageRepository,
        receipts: ReceiptRepository,
        users: UserRepository,
        message_service: MessageService,
        publisher: EventPublisher,
        presence: PresenceTracker,
    ) -> None:
        self.session = session
        self.conversations = conversations
        self.messages = messages
        self.receipts = receipts
        self.users = users
        self.message_service = message_service
        self.publisher = publisher
        self.presence = presence

    # ------------------------------------------------------------------ queries

    async def list_for(self, me: User) -> list[ConversationOut]:
        pairs = await self.conversations.memberships_for_user(me.id)
        return await self._build(me.id, pairs)

    async def get(self, me: User, conversation_id: int) -> ConversationOut:
        member = await require_member(self.conversations, conversation_id, me.id)
        conversation = await self.conversations.get(conversation_id)
        assert conversation is not None
        return (await self._build(me.id, [(member, conversation)]))[0]

    async def _build(self, me_id: int, pairs: list[Membership]) -> list[ConversationOut]:
        """Assemble list rows with a fixed number of queries, regardless of how many chats there are."""
        if not pairs:
            return []
        now = utcnow()
        ids = [conversation.id for _, conversation in pairs]
        latest_ids = await self.messages.latest_ids(ids, now)
        last_messages = {
            m.id: m for m in await self.messages.get_many_detailed(list(latest_ids.values()))
        }
        statuses = await self.receipts.statuses(
            [m.id for m in last_messages.values() if m.sender_id == me_id]
        )
        unread = await self.messages.unread_counts(me_id, now)
        members_by_conversation: dict[int, list[ConversationMember]] = {}
        for member in await self.conversations.members_of(ids):
            members_by_conversation.setdefault(member.conversation_id, []).append(member)

        result: list[ConversationOut] = []
        for my_member, conversation in pairs:
            members = members_by_conversation.get(conversation.id, [])
            last = last_messages.get(latest_ids.get(conversation.id, 0))
            if last is not None and last.id <= my_member.history_from_id:
                last = None  # never leak pre-join history through the preview
            result.append(
                ConversationOut(
                    id=conversation.id,
                    type=conversation.type,
                    name=conversation.name,
                    description=conversation.description,
                    avatar_url=conversation.avatar_url,
                    avatar_color=conversation.avatar_color,
                    disappearing_seconds=conversation.disappearing_seconds,
                    created_at=conversation.created_at,
                    last_message_at=conversation.last_message_at,
                    last_message=message_out(last, me_id, statuses.get(last.id)) if last else None,
                    unread_count=unread.get(conversation.id, 0),
                    last_read_message_id=my_member.last_read_message_id,
                    my_role=my_member.role,
                    peer=self._peer(me_id, conversation, members),
                    member_count=len(members),
                )
            )
        return result

    def _peer(
        self, me_id: int, conversation: Conversation, members: list[ConversationMember]
    ) -> UserPublic | None:
        if conversation.is_group:
            return None
        other = next((m for m in members if m.user_id != me_id), None)
        user = (other or next(iter(members))).user  # Note to Self: the only member is me
        return user_public(user, online=self.presence.is_online(user.id))

    # ------------------------------------------------------------------ commands

    async def open_direct(self, me: User, user_id: int) -> ConversationOut:
        """Get-or-create the one-to-one chat with `user_id` (yourself = Note to Self)."""
        target = me if user_id == me.id else await self.users.get(user_id)
        if target is None or target.first_name is None:
            raise not_found("This person isn't using Signal.")

        key = direct_key(me.id, target.id)
        conversation = await self.conversations.get_by_direct_key(key)
        if conversation is None:
            conversation = Conversation(
                type=ConversationType.DIRECT, direct_key=key, created_by=me.id
            )
            self.conversations.add(conversation)
            try:
                await self.session.flush()
            except IntegrityError:
                # Both users opened the chat at the same moment; use the row that won the race.
                await self.session.rollback()
                conversation = await self.conversations.get_by_direct_key(key)
                assert conversation is not None
            else:
                for uid in {me.id, target.id}:
                    self.conversations.add_member(
                        ConversationMember(conversation_id=conversation.id, user_id=uid)
                    )
                await self.session.commit()
        return await self.get(me, conversation.id)

    async def update(
        self, me: User, conversation_id: int, request: UpdateConversationRequest
    ) -> ConversationOut:
        member = await require_member(self.conversations, conversation_id, me.id)
        conversation = await self.conversations.get(conversation_id)
        assert conversation is not None
        fields = request.model_fields_set

        profile_fields = {"name", "description", "avatar_url"} & fields
        if profile_fields:
            if not conversation.is_group:
                raise bad_request("not_a_group", "Only groups have a name, description or photo.")
            if not member.is_admin:
                raise forbidden("Only admins can edit group info.")
        if "disappearing_seconds" in fields and conversation.is_group and not member.is_admin:
            raise forbidden("Only admins can change the disappearing messages timer.")

        system_events: list[tuple[str, dict[str, Any]]] = []
        if "name" in fields:
            if request.name is None:
                raise bad_request("name_required", "Group name is required.")
            if request.name != conversation.name:
                conversation.name = request.name
                system_events.append(("renamed", {"value": request.name}))
        if "description" in fields:
            conversation.description = request.description
        if "avatar_url" in fields:
            conversation.avatar_url = request.avatar_url
            system_events.append(("avatar_changed", {}))
        if "disappearing_seconds" in fields:
            seconds = request.disappearing_seconds or None
            if seconds != conversation.disappearing_seconds:
                conversation.disappearing_seconds = seconds
                system_events.append(("timer_changed", {"seconds": seconds or 0}))

        posted = [
            await self.message_service.post_system(conversation, me.id, name, **meta)
            for name, meta in system_events
        ]
        await self.session.commit()

        member_ids = await self.conversations.member_ids(conversation_id)
        await self.publisher.publish(
            member_ids, events.CONVERSATION_UPDATED, self.patch_payload(conversation)
        )
        for message in posted:
            await self.message_service.announce(message.id, member_ids)
        return await self.get(me, conversation_id)

    @staticmethod
    def patch_payload(conversation: Conversation) -> dict[str, Any]:
        return {
            "id": conversation.id,
            "name": conversation.name,
            "description": conversation.description,
            "avatar_url": conversation.avatar_url,
            "disappearing_seconds": conversation.disappearing_seconds,
        }
