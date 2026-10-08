from datetime import datetime
from enum import StrEnum

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, str_enum, utcnow
from app.models.user import User


class ConversationType(StrEnum):
    DIRECT = "direct"
    GROUP = "group"


class MemberRole(StrEnum):
    ADMIN = "admin"
    MEMBER = "member"


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[ConversationType] = mapped_column(str_enum(ConversationType, "conversation_type"))
    name: Mapped[str | None] = mapped_column(String(32))
    description: Mapped[str | None] = mapped_column(String(480))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    avatar_color: Mapped[str | None] = mapped_column(String(20))
    # "minUserId:maxUserId" for direct chats -> at most one DM per pair (and one Note to Self).
    direct_key: Mapped[str | None] = mapped_column(String(40), unique=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    disappearing_seconds: Mapped[int | None]
    last_message_at: Mapped[datetime | None] = mapped_column(index=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    members: Mapped[list["ConversationMember"]] = relationship(
        back_populates="conversation", lazy="raise", cascade="all, delete-orphan"
    )

    @property
    def is_group(self) -> bool:
        return self.type == ConversationType.GROUP


class ConversationMember(Base):
    __tablename__ = "conversation_members"

    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    role: Mapped[MemberRole] = mapped_column(
        str_enum(MemberRole, "member_role"), default=MemberRole.MEMBER
    )
    joined_at: Mapped[datetime] = mapped_column(default=utcnow)
    # Messages with id <= history_from_id were sent before this member joined and stay hidden.
    history_from_id: Mapped[int] = mapped_column(default=0)
    last_read_message_id: Mapped[int] = mapped_column(default=0)

    conversation: Mapped[Conversation] = relationship(back_populates="members", lazy="raise")
    user: Mapped[User] = relationship(lazy="joined")

    @property
    def is_admin(self) -> bool:
        return self.role == MemberRole.ADMIN
