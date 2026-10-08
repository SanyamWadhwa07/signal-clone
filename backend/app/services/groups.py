from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import bad_request, forbidden, not_found
from app.models import Conversation, ConversationMember, ConversationType, MemberRole, User
from app.realtime import events
from app.realtime.publisher import EventPublisher, PresenceTracker
from app.repositories.conversations import ConversationRepository
from app.repositories.messages import MessageRepository
from app.repositories.receipts import ReceiptRepository
from app.repositories.users import UserRepository
from app.schemas.conversation import ConversationOut, CreateGroupRequest, MemberOut
from app.services.access import require_member
from app.services.auth import avatar_color_for
from app.services.conversations import ConversationService
from app.services.messages import MessageService
from app.services.presenters import user_public
from app.services.receipts import ReceiptService

MAX_GROUP_SIZE = 100


class GroupService:
    def __init__(
        self,
        session: AsyncSession,
        conversations: ConversationRepository,
        messages: MessageRepository,
        receipts: ReceiptRepository,
        users: UserRepository,
        conversation_service: ConversationService,
        message_service: MessageService,
        receipt_service: ReceiptService,
        publisher: EventPublisher,
        presence: PresenceTracker,
    ) -> None:
        self.session = session
        self.conversations = conversations
        self.messages = messages
        self.receipts = receipts
        self.users = users
        self.conversation_service = conversation_service
        self.message_service = message_service
        self.receipt_service = receipt_service
        self.publisher = publisher
        self.presence = presence

    # ------------------------------------------------------------------ guards

    async def _group_as_admin(
        self, me: User, group_id: int
    ) -> tuple[Conversation, ConversationMember]:
        member = await require_member(self.conversations, group_id, me.id)
        conversation = await self.conversations.get(group_id)
        assert conversation is not None
        if conversation.type != ConversationType.GROUP:
            raise bad_request("not_a_group", "This isn't a group chat.")
        if not member.is_admin:
            raise forbidden("Only admins can do that.")
        return conversation, member

    async def _registered_users(self, user_ids: set[int]) -> list[User]:
        users = [u for u in await self.users.list_by_ids(user_ids) if u.first_name is not None]
        if len(users) != len(user_ids):
            raise not_found("One or more people aren't using Signal.")
        return users

    # ------------------------------------------------------------------ commands

    async def create(self, me: User, request: CreateGroupRequest) -> ConversationOut:
        member_ids = set(request.member_ids) - {me.id}
        if not member_ids:
            raise bad_request("no_members", "Pick at least one other person.")
        await self._registered_users(member_ids)

        conversation = Conversation(
            type=ConversationType.GROUP,
            name=request.name,
            avatar_url=request.avatar_url,
            avatar_color=avatar_color_for(request.name),
            created_by=me.id,
        )
        self.conversations.add(conversation)
        await self.session.flush()
        self.conversations.add_member(
            ConversationMember(
                conversation_id=conversation.id, user_id=me.id, role=MemberRole.ADMIN
            )
        )
        for user_id in member_ids:
            self.conversations.add_member(
                ConversationMember(conversation_id=conversation.id, user_id=user_id)
            )
        created = await self.message_service.post_system(
            conversation, me.id, "created", name=request.name
        )
        await self.session.commit()

        await self.message_service.announce(created.id, {me.id, *member_ids})
        return await self.conversation_service.get(me, conversation.id)

    async def list_members(self, me: User, group_id: int) -> list[MemberOut]:
        await require_member(self.conversations, group_id, me.id)
        return [
            MemberOut(
                user=user_public(m.user, online=self.presence.is_online(m.user_id)),
                role=m.role,
                joined_at=m.joined_at,
            )
            for m in await self.conversations.list_members(group_id)
        ]

    async def add_members(self, me: User, group_id: int, user_ids: list[int]) -> list[MemberOut]:
        conversation, _ = await self._group_as_admin(me, group_id)
        current = set(await self.conversations.member_ids(group_id))
        new_ids = set(user_ids) - current  # already-members are silently skipped
        if new_ids:
            if len(current) + len(new_ids) > MAX_GROUP_SIZE:
                raise bad_request("group_full", f"Groups can have up to {MAX_GROUP_SIZE} members.")
            await self._registered_users(new_ids)

            # New members start after the current last message, so they never see earlier history.
            history_from = await self.messages.max_id(group_id)
            for user_id in new_ids:
                self.conversations.add_member(
                    ConversationMember(
                        conversation_id=group_id,
                        user_id=user_id,
                        history_from_id=history_from,
                        last_read_message_id=history_from,
                    )
                )
            added = await self.message_service.post_system(
                conversation, me.id, "added", target_ids=sorted(new_ids)
            )
            await self.session.commit()
            await self.message_service.announce(added.id, current | new_ids)
        return await self.list_members(me, group_id)

    async def remove_member(self, me: User, group_id: int, user_id: int) -> None:
        conversation, _ = await self._group_as_admin(me, group_id)
        if user_id == me.id:
            raise bad_request("use_leave", "Use “Leave group” to remove yourself.")
        target = await self.conversations.get_member(group_id, user_id)
        if target is None:
            raise not_found("That person isn't in this group.")
        await self._drop_member(conversation, target, actor_id=me.id, event="removed")

    async def set_role(self, me: User, group_id: int, user_id: int, role: MemberRole) -> None:
        conversation, _ = await self._group_as_admin(me, group_id)
        target = await self.conversations.get_member(group_id, user_id)
        if target is None:
            raise not_found("That person isn't in this group.")
        if target.role == role:
            return
        if role == MemberRole.MEMBER and await self._admin_count(group_id) <= 1:
            raise bad_request("last_admin", "A group needs at least one admin.")

        target.role = role
        event = "promoted" if role == MemberRole.ADMIN else "demoted"
        posted = await self.message_service.post_system(
            conversation, me.id, event, target_ids=[user_id]
        )
        await self.session.commit()
        await self.message_service.announce(
            posted.id, await self.conversations.member_ids(group_id)
        )

    async def leave(self, me: User, group_id: int) -> None:
        member = await require_member(self.conversations, group_id, me.id)
        conversation = await self.conversations.get(group_id)
        assert conversation is not None
        if conversation.type != ConversationType.GROUP:
            raise bad_request("not_a_group", "This isn't a group chat.")

        if member.is_admin and await self._admin_count(group_id) <= 1:
            await self._promote_successor(group_id, leaving_user_id=me.id)
        await self._drop_member(conversation, member, actor_id=me.id, event="left")

    # ------------------------------------------------------------------ helpers

    async def _admin_count(self, group_id: int) -> int:
        members = await self.conversations.list_members(group_id)
        return sum(1 for m in members if m.is_admin)

    async def _promote_successor(self, group_id: int, leaving_user_id: int) -> None:
        """When the last admin leaves, the longest-standing remaining member takes over."""
        others = [
            m
            for m in await self.conversations.list_members(group_id)
            if m.user_id != leaving_user_id
        ]
        if others:
            min(others, key=lambda m: m.joined_at).role = MemberRole.ADMIN

    async def _drop_member(
        self, conversation: Conversation, member: ConversationMember, *, actor_id: int, event: str
    ) -> None:
        removed_id = member.user_id
        # Their unread receipts go too, so remaining members' delivered/read ticks can still complete.
        orphaned = await self.receipts.delete_unread_for_member(conversation.id, removed_id)
        await self.conversations.delete_member(member)
        await self.session.flush()

        posted = await self.message_service.post_system(
            conversation, actor_id, event, target_ids=[removed_id]
        )
        await self.session.commit()

        remaining = await self.conversations.member_ids(conversation.id)
        await self.message_service.announce(posted.id, remaining)
        await self.publisher.publish(
            [removed_id],
            events.CONVERSATION_REMOVED,
            {"conversation_id": conversation.id, "reason": event, "name": conversation.name},
        )
        if orphaned:
            await self.receipt_service.publish_statuses(orphaned)
