"""Cross-cutting protections: rate limiting, fail-fast config, error shape, headers, health."""

from collections.abc import AsyncIterator

import httpx
import pytest

from app.core.config import DEFAULT_JWT_SECRET, Settings
from app.core.errors import AppError
from app.core.rate_limit import RateLimiter
from app.main import create_app
from tests.conftest import API, OTP, FakeRealtime, UserFactory


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


# ---------------------------------------------------------------- RateLimiter (unit)


def test_rate_limiter_blocks_over_the_limit_and_recovers_after_the_window() -> None:
    clock = FakeClock()
    limiter = RateLimiter(limit=3, window_seconds=60, clock=clock)
    for _ in range(3):
        limiter.check("ip")

    with pytest.raises(AppError) as blocked:
        limiter.check("ip")
    assert blocked.value.status == 429
    assert blocked.value.code == "rate_limited"
    assert blocked.value.headers == {"Retry-After": "60"}

    clock.now += 61
    limiter.check("ip")  # the window has slid past the old hits


def test_rate_limiter_keeps_keys_independent_and_can_be_disabled() -> None:
    limiter = RateLimiter(limit=1, window_seconds=60)
    limiter.check("a")
    limiter.check("b")  # a different client is unaffected
    off = RateLimiter(limit=1, enabled=False)
    for _ in range(10):
        off.check("a")


# ---------------------------------------------------------------- through the API


@pytest.fixture
async def strict_client(
    settings: Settings, realtime: FakeRealtime
) -> AsyncIterator[httpx.AsyncClient]:
    strict = settings.model_copy(
        update={"rate_limit_auth_per_minute": 3, "rate_limit_send_per_minute": 2}
    )
    app = create_app(strict, realtime=realtime)  # type: ignore[arg-type]
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
            yield http


async def test_login_attempts_are_rate_limited_per_client(strict_client: httpx.AsyncClient) -> None:
    body = {"phone": "+919876500001", "code": "000000"}
    statuses = [
        (await strict_client.post(f"{API}/auth/verify-otp", json=body)).status_code
        for _ in range(5)
    ]
    assert statuses == [400, 400, 400, 429, 429]

    blocked = await strict_client.post(f"{API}/auth/verify-otp", json=body)
    assert blocked.json()["error"]["code"] == "rate_limited"
    assert int(blocked.headers["retry-after"]) >= 1


async def test_message_sending_is_rate_limited_per_user(strict_client: httpx.AsyncClient) -> None:
    # Each sign-up spends 2 of the 3 auth hits, so use a roomier limiter for setup via X-Forwarded-For.
    async def signup(phone: str, name: str):
        response = await strict_client.post(
            f"{API}/auth/verify-otp",
            json={"phone": phone, "code": OTP},
            headers={"x-forwarded-for": phone},
        )
        token = response.json()["token"]
        await strict_client.patch(
            f"{API}/users/me",
            json={"first_name": name},
            headers={"Authorization": f"Bearer {token}"},
        )
        return response.json()["user"]["id"], {"Authorization": f"Bearer {token}"}

    _, alex = await signup("+919876500001", "Alex")
    bob_id, _ = await signup("+919876500002", "Bob")
    chat = (
        await strict_client.post(
            f"{API}/conversations/direct", json={"user_id": bob_id}, headers=alex
        )
    ).json()

    results = []
    for i in range(4):
        response = await strict_client.post(
            f"{API}/conversations/{chat['id']}/messages",
            json={"client_id": f"client-id-{i:04d}", "body": f"m{i}"},
            headers=alex,
        )
        results.append(response.status_code)
    assert results == [201, 201, 429, 429]


# ---------------------------------------------------------------- fail fast, errors, headers


def test_production_refuses_to_start_with_the_default_secret(settings: Settings) -> None:
    unsafe = settings.model_copy(
        update={"environment": "production", "jwt_secret": DEFAULT_JWT_SECRET}
    )
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        create_app(unsafe)

    safe = settings.model_copy(update={"environment": "production", "jwt_secret": "x" * 40})
    create_app(safe)  # a real secret is fine


async def test_unexpected_errors_return_the_standard_json_shape(
    settings: Settings, realtime: FakeRealtime
) -> None:
    app = create_app(settings, realtime=realtime)  # type: ignore[arg-type]

    @app.get("/boom")
    async def boom() -> None:
        raise ZeroDivisionError("secret internals")

    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
            response = await http.get("/boom")
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "secret internals" not in response.text  # nothing internal leaks


async def test_security_headers_and_no_store_on_the_api(client: httpx.AsyncClient) -> None:
    api = await client.get(f"{API}/auth/me")
    assert api.headers["x-content-type-options"] == "nosniff"
    assert api.headers["x-frame-options"] == "DENY"
    assert api.headers["referrer-policy"] == "no-referrer"
    assert api.headers["cache-control"] == "no-store"  # per-user data must not be cached


async def test_health_checks_the_database(client: httpx.AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


# ---------------------------------------------------------------- name validation


async def test_first_name_must_be_a_single_word_without_digits(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    for bad in ("Sanyam Wadhwa", "Sany4m", " Mary Jane "):
        response = await alex.patch("/users/me", json={"first_name": bad})
        assert response.status_code == 422, bad
        assert "First name" in response.json()["error"]["message"]

    ok = await alex.patch(
        "/users/me", json={"first_name": "Anne-Marie", "last_name": "Van Der Berg"}
    )
    assert ok.status_code == 200
    assert ok.json()["display_name"] == "Anne-Marie Van Der Berg"
