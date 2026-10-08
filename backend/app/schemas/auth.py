from pydantic import Field, field_validator

from app.schemas.common import Schema, normalize_phone
from app.schemas.user import UserMe


class PhoneRequest(Schema):
    phone: str = Field(max_length=30)

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str) -> str:
        return normalize_phone(value)


class RequestOtpResponse(Schema):
    phone: str
    # Verification is mocked; the hint tells the demo user which code to type.
    hint: str


class VerifyOtpRequest(PhoneRequest):
    code: str = Field(min_length=4, max_length=8)


class AuthResponse(Schema):
    token: str
    user: UserMe
    needs_profile: bool
