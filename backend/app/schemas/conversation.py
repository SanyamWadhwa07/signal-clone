from datetime import datetime

from pydantic import Field, field_validator

from app.models import ConversationType, MemberRole
from app.schemas.common import Schema, strip_or_none
from app.schemas.message import MessageOut
from app.schemas.user import UserPublic

# Signal's disappearing-message presets (seconds). None/0 = off.
DISAPPEARING_OPTIONS = {30, 300, 3600, 8 * 3600, 86400, 7 * 86400, 28 * 86400}


class ConversationOut(Schema):
    id: int
    type: ConversationType
    name: str | None
    description: str | None
    avatar_url: str | None
    avatar_color: str | None
    disappearing_seconds: int | None
    created_at: datetime
    last_message_at: datetime | None
    last_message: MessageOut | None
    unread_count: int
    last_read_message_id: int
    my_role: MemberRole
    # Direct chats: the other participant (yourself for Note to Self). Groups: None.
    peer: UserPublic | None
    member_count: int


class OpenDirectRequest(Schema):
    user_id: int


class UpdateConversationRequest(Schema):
    """Partial update. `disappearing_seconds`: 0 turns the timer off."""

    name: str | None = Field(default=None, max_length=32)
    description: str | None = Field(default=None, max_length=480)
    avatar_url: str | None = Field(default=None, max_length=500)
    disappearing_seconds: int | None = None

    @field_validator("name", "description", "avatar_url")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        return strip_or_none(value)

    @field_validator("disappearing_seconds")
    @classmethod
    def _timer(cls, value: int | None) -> int | None:
        if value is not None and value != 0 and value not in DISAPPEARING_OPTIONS:
            raise ValueError("Unsupported disappearing message timer")
        return value


class ReadRequest(Schema):
    up_to_id: int = Field(ge=0)


class ReadStateOut(Schema):
    conversation_id: int
    last_read_message_id: int


class MemberOut(Schema):
    user: UserPublic
    role: MemberRole
    joined_at: datetime


class CreateGroupRequest(Schema):
    name: str = Field(min_length=1, max_length=32)
    member_ids: list[int] = Field(min_length=1, max_length=99)
    avatar_url: str | None = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Group name is required")
        return value


class AddMembersRequest(Schema):
    user_ids: list[int] = Field(min_length=1, max_length=99)


class UpdateRoleRequest(Schema):
    role: MemberRole
