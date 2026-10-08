import pytest

from app.schemas.common import normalize_phone
from app.services.attachments import sanitize_filename
from app.services.auth import AVATAR_COLORS, avatar_color_for
from app.services.conversations import direct_key


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("+91 98765 43210", "+919876543210"),
        ("+1 (555) 010-0001", "+15550100001"),
        ("0044 20 7183 8750", "+442071838750"),
    ],
)
def test_normalize_phone(raw: str, expected: str) -> None:
    assert normalize_phone(raw) == expected


@pytest.mark.parametrize("raw", ["", "12345", "+0123456789", "+123456", "abc", "+" + "1" * 16])
def test_normalize_phone_rejects_garbage(raw: str) -> None:
    with pytest.raises(ValueError):
        normalize_phone(raw)


def test_direct_key_is_symmetric() -> None:
    assert direct_key(7, 3) == direct_key(3, 7) == "3:7"
    assert direct_key(5, 5) == "5:5"  # Note to Self


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("photo.png", "photo.png"),
        ("../../etc/passwd", "passwd"),
        ("C:\\Users\\me\\doc.pdf", "doc.pdf"),
        ("we<ird>:na*me?.txt", "we_ird__na_me_.txt"),
        ("   ", "file"),
        ("a" * 300 + ".txt", ("a" * 300 + ".txt")[:120]),
    ],
)
def test_sanitize_filename(raw: str, expected: str) -> None:
    assert sanitize_filename(raw) == expected


def test_avatar_color_is_stable_and_from_the_palette() -> None:
    assert avatar_color_for("+15550100001") == avatar_color_for("+15550100001")
    assert avatar_color_for("anything") in AVATAR_COLORS
