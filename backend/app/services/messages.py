from collections import defaultdict
from collections.abc import Iterable
from datetime import timedelta
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import bad_request, forbidden, not_found
from app.models import Attachment, Conversation, ConversationMember, Message, MessageKind
from app.models.base import utcnow
from app.realtime import events
from app.realtime.publisher import EventPublisher, PresenceTracker
from app.repositories.attachments import AttachmentRepository
from app.repositories.conversations import ConversationRepository
from app.repositories.messages import MessageRepository
from app.repositories.reactions import ReactionRepository
from app.repositories.receipts import ReceiptRepository
from app.schemas.message import MessageOut, MessagePage, SendMessageRequest
from app.services.access import require_member
from app.services.presenters import message_out
from app.services.storage import FileStorage

DELETE_WINDOW = timedelta(hours=24)
MAX_PAGE_SIZE = 100


class MessageService:
    def __init__(
        self,
        session: AsyncSession,
        messages: MessageRepository,
        conversations: ConversationRepository,
        receipts: ReceiptRepository,
        reactions: ReactionRepository,
        attachments: AttachmentRepository,
        publisher: EventPublisher,
        presence: PresenceTracker,
        storage: FileStorage,
    ) -> None:
        self.session = session
        self.messages = messages
        self.conversations = conversations
        self.receipts = receipts
        self.reactions = reactions
        self.attachments = attachments
        self.publisher = publisher
        self.presence = presence
        self.storage = storage

    # ------------------------------------------------------------------ sending

    async def send(
        self, sender_id: int, conversation_id: int, request: SendMessageRequest
    ) -> tuple[MessageOut, bool]:
        """Persist + fan out a message. Returns (message, created); a retried client_id is a no-op."""
        member = await require_member(self.conversations, conversation_id, sender_id)

        existing = await self.messages.get_by_client_id(sender_id, request.client_id)
        if existing is not None:
            return await self._as_viewer(existing.id, sender_id), False

        if request.body is None and request.attachment_id is None:
            raise bad_request("empty_message", "Write a message or attach a file.")
        await self._validate_reply(member, conversation_id, request.reply_to_id)
        attachment = await self._claim_attachment(sender_id, request.attachment_id)

        conversation = await self.conversations.get(conversation_id)
        assert conversation is not None
        now = utcnow()
        expires_at = (
            now + timedelta(seconds=conversation.disappearing_seconds)
            if conversation.disappearing_seconds
            else None
        )
        message = Message(
            conversation_id=conversation_id,
            sender_id=sender_id,
            client_id=request.client_id,
            kind=MessageKind.ATTACHMENT if attachment else MessageKind.TEXT,
            body=request.body,
            reply_to_id=request.reply_to_id,
            created_at=now,
            expires_at=expires_at,
        )
        self.messages.add(message)
        try:
            await self.session.flush()
        except IntegrityError:
            # Two concurrent retries of the same client_id: the other one won, return its result.
            await self.session.rollback()
            winner = await self.messages.get_by_client_id(sender_id, request.client_id)
            if winner is None:
                raise
            return await self._as_viewer(winner.id, sender_id), False

        if attachment is not None:
            attachment.message_id = message.id

        member_ids = await self.conversations.member_ids(conversation_id)
        recipients = [uid for uid in member_ids if uid != sender_id]
        online = {uid for uid in recipients if self.presence.is_online(uid)}
        self.receipts.add_for_recipients(message.id, recipients, delivered_to=online, now=now)

        conversation.last_message_at = now
        member.last_read_message_id = message.id  # my own messages are never unread for me
        await self.session.commit()

        await self._publish_new(message.id, member_ids)
        return await self._as_viewer(message.id, sender_id), True

    async def post_system(
        self, conversation: Conversation, actor_id: int | None, event: str, **meta: Any
    ) -> Message:
        """Add a system message (group/timer events). The caller commits, then calls `announce`."""
        now = utcnow()
        message = Message(
            conversation_id=conversation.id,
            sender_id=None,
            kind=MessageKind.SYSTEM,
            meta={"event": event, "actor_id": actor_id, **meta},
            created_at=now,
        )
        self.messages.add(message)
        conversation.last_message_at = now
        await self.session.flush()
        return message

    async def announce(self, message_id: int, recipient_ids: Iterable[int]) -> None:
        await self._publish_new(message_id, recipient_ids)

    async def _validate_reply(
        self, member: ConversationMember, conversation_id: int, reply_to_id: int | None
    ) -> None:
        if reply_to_id is None:
            return
        target = await self.messages.get(reply_to_id)
        if (
            target is None
            or target.conversation_id != conversation_id
            or target.id <= member.history_from_id
            or target.kind == MessageKind.SYSTEM
        ):
            raise bad_request("invalid_reply", "The message you're replying to is unavailable.")

    async def _claim_attachment(self, user_id: int, attachment_id: int | None) -> Attachment | None:
        if attachment_id is None:
            return None
        attachment = await self.attachments.get(attachment_id)
        if attachment is None or attachment.uploader_id != user_id or attachment.message_id:
            raise bad_request("invalid_attachment", "That attachment can't be sent.")
        return attachment

    # ------------------------------------------------------------------ reading

    async def history(
        self,
        viewer_id: int,
        conversation_id: int,
        *,
        before_id: int | None,
        after_id: int | None,
        limit: int,
    ) -> MessagePage:
        member = await require_member(self.conversations, conversation_id, viewer_id)
        rows, has_more = await self.messages.page(
            conversation_id,
            history_from_id=member.history_from_id,
            now=utcnow(),
            before_id=before_id,
            after_id=after_id,
            limit=max(1, min(limit, MAX_PAGE_SIZE)),
        )
        statuses = await self.receipts.statuses([m.id for m in rows if m.sender_id == viewer_id])
        items = [message_out(m, viewer_id, statuses.get(m.id)) for m in rows]
        return MessagePage(items=items, has_more=has_more)

    # ------------------------------------------------------------------ mutation

    async def delete(self, user_id: int, message_id: int) -> None:
        """Delete for everyone: the sender, or a group admin, within 24 hours."""
        message = await self.messages.get(message_id)
        if message is None:
            raise not_found("Message not found.")
        member = await require_member(self.conversations, message.conversation_id, user_id)
        if message.kind == MessageKind.SYSTEM or message.is_deleted:
            raise bad_request("not_deletable", "This message can't be deleted.")

        is_sender = message.sender_id == user_id
        if not is_sender and not member.is_admin:
            raise forbidden("You can only delete your own messages.")
        conversation = await self.conversations.get(message.conversation_id)
        if not is_sender and (conversation is None or not conversation.is_group):
            raise forbidden("You can only delete your own messages.")
        if utcnow() - message.created_at > DELETE_WINDOW:
            raise forbidden("Messages can only be deleted within 24 hours.", "delete_window_passed")

        attachments = await self.attachments.for_messages([message.id])
        for attachment in attachments:
            await self.storage.delete(attachment.storage_key)
            await self.attachments.delete(attachment)
        await self.reactions.delete(message.id)
        message.deleted_at = utcnow()
        message.body = None
        message.meta = None if is_sender else {"deleted_by": user_id}
        await self.session.commit()

        member_ids = await self.conversations.member_ids(message.conversation_id)
        await self.publisher.publish(
            member_ids,
            events.MESSAGE_DELETED,
            {
                "conversation_id": message.conversation_id,
                "message_id": message.id,
                "deleted_by": user_id,
            },
        )

    async def purge_expired(self) -> int:
        """Hard-delete disappeared messages (and their files), then tell the affected members."""
        expired = await self.messages.expired(utcnow())
        if not expired:
            return 0
        ids = [message_id for message_id, _ in expired]
        for attachment in await self.attachments.for_messages(ids):
            await self.storage.delete(attachment.storage_key)
        by_conversation: dict[int, list[int]] = defaultdict(list)
        for message_id, conversation_id in expired:
            by_conversation[conversation_id].append(message_id)

        await self.messages.delete_ids(ids)
        await self.session.commit()

        for conversation_id, message_ids in by_conversation.items():
            member_ids = await self.conversations.member_ids(conversation_id)
            await self.publisher.publish(
                member_ids,
                events.MESSAGE_EXPIRED,
                {"conversation_id": conversation_id, "message_ids": message_ids},
            )
        return len(ids)

    # ------------------------------------------------------------------ publishing

    async def _as_viewer(self, message_id: int, viewer_id: int) -> MessageOut:
        message = await self.messages.get_detailed(message_id)
        assert message is not None
        statuses = await self.receipts.statuses([message_id])
        return message_out(message, viewer_id, statuses.get(message_id))

    async def _publish_new(self, message_id: int, recipient_ids: Iterable[int]) -> None:
        message = await self.messages.get_detailed(message_id)
        if message is None:
            return
        statuses = await self.receipts.statuses([message_id])
        status = statuses.get(message_id)
        for user_id in set(recipient_ids):
            await self.publisher.publish(
                [user_id], events.MESSAGE_NEW, {"message": message_out(message, user_id, status)}
            )
