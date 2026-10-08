from datetime import datetime
from typing import Any, Literal

from pydantic import Field, field_validator

from app.models import MessageKind
from app.schemas.common import Schema

MessageStatus = Literal["sent", "delivered", "read"]


class AttachmentOut(Schema):
    id: int
    url: str
    name: str
    mime: str
    size: int


class QuotedMessage(Schema):
    id: int
    sender_id: int | None
    kind: MessageKind
    body: str | None
    attachment: AttachmentOut | None
    deleted: bool


class ReactionOut(Schema):
    user_id: int
    emoji: str


class MessageOut(Schema):
    id: int
    conversation_id: int
    sender_id: int | None
    client_id: str | None
    kind: MessageKind
    body: str | None
    meta: dict[str, Any] | None
    reply_to: QuotedMessage | None
    attachment: AttachmentOut | None
    reactions: list[ReactionOut]
    # Only meaningful for the sender's own messages.
    status: MessageStatus | None
    created_at: datetime
    expires_at: datetime | None
    deleted: bool


class MessagePage(Schema):
    items: list[MessageOut]
    has_more: bool


class SendMessageRequest(Schema):
    client_id: str = Field(min_length=8, max_length=64)
    body: str | None = Field(default=None, max_length=4000)
    reply_to_id: int | None = None
    attachment_id: int | None = None

    @field_validator("body")
    @classmethod
    def _trim(cls, value: str | None) -> str | None:
        # Keep inner newlines, drop surrounding whitespace; whitespace-only becomes None.
        if value is None:
            return None
        value = value.strip()
        return value or None


class ReactRequest(Schema):
    emoji: str = Field(min_length=1, max_length=16)


class MessageSearchHit(Schema):
    message: MessageOut
    conversation_id: int
