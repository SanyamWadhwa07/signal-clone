import re

from pydantic import BaseModel, ConfigDict

_PHONE_STRIP = re.compile(r"[\s\-().]")
_E164 = re.compile(r"^\+[1-9]\d{6,14}$")
USERNAME_PATTERN = r"^[a-z0-9_]{3,32}(\.\d{2})?$"


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


def normalize_phone(raw: str) -> str:
    """Normalize to E.164 (+<country><number>). Raises ValueError for anything else."""
    phone = _PHONE_STRIP.sub("", raw.strip())
    if phone.startswith("00"):
        phone = "+" + phone[2:]
    if not _E164.match(phone):
        raise ValueError("Enter a valid phone number with country code, e.g. +91 98765 43210")
    return phone


def strip_or_none(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None
