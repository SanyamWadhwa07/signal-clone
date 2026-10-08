from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, str_enum, utcnow


class MessageKind(StrEnum):
    TEXT = "text"
    ATTACHMENT = "attachment"
    SYSTEM = "system"  # group/timer events; rendered client-side from `meta`


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        # Retrying a send with the same client_id never creates a duplicate.
        UniqueConstraint("sender_id", "client_id", name="uq_message_sender_client"),
        Index("ix_messages_conversation_id_id", "conversation_id", "id"),
        # Ids are cursors and read markers: never reuse an id after disappearing messages are purged.
        {"sqlite_autoincrement": True},
    )

    # Monotonic id doubles as the ordering key and pagination cursor (never trust clocks for order).
    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"))
    sender_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    client_id: Mapped[str | None] = mapped_column(String(64))
    kind: Mapped[MessageKind] = mapped_column(str_enum(MessageKind, "message_kind"))
    body: Mapped[str | None] = mapped_column(Text)
    meta: Mapped[dict[str, Any] | None]
    reply_to_id: Mapped[int | None] = mapped_column(ForeignKey("messages.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(index=True)
    deleted_at: Mapped[datetime | None]

    reply_to: Mapped["Message | None"] = relationship(remote_side=[id], lazy="raise")
    attachment: Mapped["Attachment | None"] = relationship(back_populates="message", lazy="raise")
    receipts: Mapped[list["MessageReceipt"]] = relationship(lazy="raise")
    reactions: Mapped[list["Reaction"]] = relationship(lazy="raise", order_by="Reaction.created_at")

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


class Attachment(Base):
    """Uploaded first (message_id NULL), then linked when the message is sent."""

    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    uploader_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    message_id: Mapped[int | None] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"), unique=True
    )
    original_name: Mapped[str] = mapped_column(String(120))
    mime: Mapped[str] = mapped_column(String(100))
    size: Mapped[int]
    storage_key: Mapped[str] = mapped_column(String(80), unique=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)

    message: Mapped[Message | None] = relationship(back_populates="attachment", lazy="raise")


class MessageReceipt(Base):
    """Per-recipient delivery/read state. A message's status is the aggregate over its receipts."""

    __tablename__ = "message_receipts"
    __table_args__ = (Index("ix_receipts_user_delivered", "user_id", "delivered_at"),)

    message_id: Mapped[int] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    delivered_at: Mapped[datetime | None]
    read_at: Mapped[datetime | None]


class Reaction(Base):
    """One reaction per user per message (Signal semantics); re-reacting replaces the emoji."""

    __tablename__ = "reactions"

    message_id: Mapped[int] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    emoji: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
