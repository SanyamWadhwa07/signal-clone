from datetime import datetime

from pydantic import Field, field_validator, model_validator

from app.schemas.common import Schema, normalize_phone, strip_or_none
from app.schemas.user import UserPublic


class ContactOut(Schema):
    id: int
    nickname: str | None
    user: UserPublic
    created_at: datetime


class CreateContactRequest(Schema):
    phone: str | None = Field(default=None, max_length=30)
    username: str | None = Field(default=None, max_length=40)
    nickname: str | None = Field(default=None, max_length=50)

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str | None) -> str | None:
        value = strip_or_none(value)
        return normalize_phone(value) if value else None

    @field_validator("username", "nickname")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        return strip_or_none(value)

    @model_validator(mode="after")
    def _exactly_one_identifier(self) -> "CreateContactRequest":
        if bool(self.phone) == bool(self.username):
            raise ValueError("Provide either a phone number or a username")
        return self


class UpdateContactRequest(Schema):
    nickname: str | None = Field(default=None, max_length=50)

    @field_validator("nickname")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        return strip_or_none(value)
