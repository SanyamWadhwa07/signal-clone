import re
from datetime import datetime

from pydantic import Field, field_validator

from app.schemas.common import USERNAME_PATTERN, Schema, strip_or_none


class UserPublic(Schema):
    id: int
    phone: str
    username: str | None
    first_name: str | None
    last_name: str | None
    display_name: str
    about: str | None
    avatar_url: str | None
    avatar_color: str
    last_seen_at: datetime | None
    online: bool = False


class UserSettings(Schema):
    read_receipts: bool = True
    typing_indicators: bool = True


class UserMe(UserPublic):
    settings: UserSettings


class UserSettingsPatch(Schema):
    read_receipts: bool | None = None
    typing_indicators: bool | None = None


class UpdateMeRequest(Schema):
    """Partial update: only fields present in the request body are applied."""

    first_name: str | None = Field(default=None, max_length=26)
    last_name: str | None = Field(default=None, max_length=26)
    about: str | None = Field(default=None, max_length=140)
    username: str | None = Field(default=None, max_length=40)
    avatar_url: str | None = Field(default=None, max_length=500)
    settings: UserSettingsPatch | None = None

    @field_validator("first_name", "last_name", "about", "avatar_url")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        return strip_or_none(value)

    @field_validator("first_name")
    @classmethod
    def _single_word(cls, value: str | None) -> str | None:
        """A first name is one word (surnames go in last_name, which may contain spaces)."""
        if value is not None and any(ch.isspace() or ch.isdigit() for ch in value):
            raise ValueError(
                "First name can't contain spaces or numbers. Put your surname in Last name."
            )
        return value

    @field_validator("username")
    @classmethod
    def _username(cls, value: str | None) -> str | None:
        value = strip_or_none(value)
        if value is None:
            return None
        value = value.lower()
        if not re.match(USERNAME_PATTERN, value):
            raise ValueError(
                "Usernames are 3–32 lowercase letters, numbers or underscores, "
                "optionally followed by .NN (e.g. sanyam_w.07)"
            )
        return value
