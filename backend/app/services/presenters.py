"""Pure mappers from ORM rows to API DTOs. No I/O: callers load everything first."""

from app.models import Attachment, Message, User
from app.schemas.message import (
    AttachmentOut,
    MessageOut,
    MessageStatus,
    QuotedMessage,
    ReactionOut,
)
from app.schemas.user import UserMe, UserPublic, UserSettings

UPLOADS_PREFIX = "/uploads"


def attachment_out(attachment: Attachment) -> AttachmentOut:
    return AttachmentOut(
        id=attachment.id,
        url=f"{UPLOADS_PREFIX}/{attachment.storage_key}",
        name=attachment.original_name,
        mime=attachment.mime,
        size=attachment.size,
    )


def user_public(user: User, *, online: bool = False) -> UserPublic:
    return UserPublic(
        id=user.id,
        phone=user.phone,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        display_name=user.display_name,
        about=user.about,
        avatar_url=user.avatar_url,
        avatar_color=user.avatar_color,
        last_seen_at=user.last_seen_at,
        online=online,
    )


def user_me(user: User, *, online: bool = True) -> UserMe:
    base = user_public(user, online=online)
    return UserMe(
        **base.model_dump(),
        settings=UserSettings(
            read_receipts=user.setting("read_receipts"),
            typing_indicators=user.setting("typing_indicators"),
        ),
    )


def _quoted(message: Message) -> QuotedMessage:
    deleted = message.is_deleted
    return QuotedMessage(
        id=message.id,
        sender_id=message.sender_id,
        kind=message.kind,
        body=None if deleted else message.body,
        attachment=None
        if deleted or message.attachment is None
        else attachment_out(message.attachment),
        deleted=deleted,
    )


def message_out(message: Message, viewer_id: int, status: MessageStatus | None) -> MessageOut:
    """`status` is only exposed on the viewer's own messages."""
    deleted = message.is_deleted
    return MessageOut(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        client_id=message.client_id,
        kind=message.kind,
        body=None if deleted else message.body,
        meta=message.meta,
        reply_to=_quoted(message.reply_to) if message.reply_to is not None else None,
        attachment=None
        if deleted or message.attachment is None
        else attachment_out(message.attachment),
        reactions=[]
        if deleted
        else [ReactionOut(user_id=r.user_id, emoji=r.emoji) for r in message.reactions],
        status=status if message.sender_id == viewer_id else None,
        created_at=message.created_at,
        expires_at=message.expires_at,
        deleted=deleted,
    )
