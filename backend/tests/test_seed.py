"""The demo data is part of the product (reviewers see it first), so it is tested like code."""

from collections.abc import AsyncIterator

import httpx
import pytest

from app.core.config import Settings
from app.main import create_app
from app.seed.data import DIRECTS, GROUPS, USERS
from tests.conftest import API, OTP

SANYAM = "+919876500001"


@pytest.fixture
async def seeded(settings: Settings) -> AsyncIterator[httpx.AsyncClient]:
    app = create_app(settings.model_copy(update={"seed_on_startup": True}))
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
            yield http


async def login(client: httpx.AsyncClient, phone: str) -> dict[str, str]:
    response = await client.post(f"{API}/auth/verify-otp", json={"phone": phone, "code": OTP})
    assert response.status_code == 200
    assert response.json()["needs_profile"] is False  # seeded users are fully onboarded
    return {"Authorization": f"Bearer {response.json()['token']}"}


async def test_every_seeded_user_can_sign_in_and_has_a_complete_profile(
    seeded: httpx.AsyncClient,
) -> None:
    for spec in USERS:
        headers = await login(seeded, spec.phone)
        me = (await seeded.get(f"{API}/auth/me", headers=headers)).json()
        assert me["first_name"] == spec.first
        assert me["phone"].startswith("+91")  # Indian numbers, as in the brief's audience
        assert (me["avatar_url"] is not None) == (spec.avatar is not None)


async def test_main_demo_account_has_a_rich_inbox(seeded: httpx.AsyncClient) -> None:
    headers = await login(seeded, SANYAM)
    chats = (await seeded.get(f"{API}/conversations", headers=headers)).json()

    direct = [c for c in chats if c["type"] == "direct"]
    groups = [c for c in chats if c["type"] == "group"]
    assert len(direct) >= 8 and len(groups) >= 5
    assert sum(1 for c in chats if c["unread_count"] > 0) >= 5  # badges visible on first load
    assert any(c["peer"]["id"] == me_id(chats) for c in direct)  # Note to Self

    # most recent activity first
    times = [c["last_message_at"] for c in chats]
    assert times == sorted(times, reverse=True)

    # contact nicknames are honoured by the contacts API
    contacts = (await seeded.get(f"{API}/contacts", headers=headers)).json()
    assert {"Mummy", "Didi"} <= {c["nickname"] for c in contacts}


def me_id(chats: list[dict]) -> int:
    note = next(c for c in chats if c["type"] == "direct" and c["peer"]["phone"] == SANYAM)
    return note["peer"]["id"]


async def test_group_icons_and_avatars_are_real_images_served_by_the_api(
    seeded: httpx.AsyncClient,
) -> None:
    headers = await login(seeded, SANYAM)
    chats = (await seeded.get(f"{API}/conversations", headers=headers)).json()
    urls = [c["avatar_url"] for c in chats if c["type"] == "group"]
    urls += [
        c["peer"]["avatar_url"] for c in chats if c["type"] == "direct" and c["peer"]["avatar_url"]
    ]
    assert len(urls) >= 10
    for url in urls:
        image = await seeded.get(url)
        assert image.status_code == 200
        assert image.content.startswith(b"\x89PNG")


async def test_seeded_conversations_have_the_expected_depth(seeded: httpx.AsyncClient) -> None:
    headers = await login(seeded, SANYAM)
    chats = (await seeded.get(f"{API}/conversations", headers=headers)).json()
    longest = 0
    for chat in chats:
        page = (
            await seeded.get(
                f"{API}/conversations/{chat['id']}/messages?limit=100", headers=headers
            )
        ).json()
        longest = max(longest, len(page["items"]))
    assert longest >= 25  # long enough to scroll, paginate and show several day dividers


def test_seed_quotes_all_point_at_real_messages() -> None:
    """`quote` lookups raise at seed time if a line quotes text that doesn't exist; check up front."""
    for spec in [*DIRECTS, *GROUPS]:
        seen: list[str] = []
        for line in spec.lines:
            if line.quote is not None:
                assert any(body.startswith(line.quote) for body in seen), line.quote
            if line.body:
                seen.append(line.body)


def test_seed_timeline_is_chronological_and_unread_counts_are_possible() -> None:
    for spec in [*DIRECTS, *GROUPS]:
        agos = [line.ago_min for line in spec.lines]
        assert agos == sorted(agos, reverse=True), spec  # oldest first
        for user, count in spec.unread.items():
            theirs = [ln for ln in spec.lines if ln.sender not in ("system", user)]
            assert 0 < count <= len(theirs)
