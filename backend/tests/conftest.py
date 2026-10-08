from collections.abc import AsyncIterator, Iterable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from fastapi.encoders import jsonable_encoder

from app.core.config import Settings
from app.main import create_app

API = "/api/v1"
OTP = "123456"


class FakeRealtime:
    """Records published events instead of pushing them over sockets; `online` is test-controlled."""

    def __init__(self) -> None:
        self.events: list[tuple[int, str, Any]] = []
        self.online: set[int] = set()

    async def publish(self, user_ids: Iterable[int], event: str, payload: Any) -> None:
        body = jsonable_encoder(payload)
        for user_id in set(user_ids):
            self.events.append((user_id, event, body))

    def is_online(self, user_id: int) -> bool:
        return user_id in self.online

    def received(self, user_id: int, event: str) -> list[Any]:
        return [p for uid, e, p in self.events if uid == user_id and e == event]

    def clear(self) -> None:
        self.events.clear()


@dataclass
class Actor:
    """A logged-in test user with convenience HTTP helpers."""

    client: httpx.AsyncClient
    id: int
    phone: str
    token: str
    headers: dict[str, str] = field(init=False)

    def __post_init__(self) -> None:
        self.headers = {"Authorization": f"Bearer {self.token}"}

    async def request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        return await self.client.request(method, f"{API}{path}", headers=self.headers, **kwargs)

    async def get(self, path: str, **kw: Any) -> httpx.Response:
        return await self.request("GET", path, **kw)

    async def post(self, path: str, **kw: Any) -> httpx.Response:
        return await self.request("POST", path, **kw)

    async def patch(self, path: str, **kw: Any) -> httpx.Response:
        return await self.request("PATCH", path, **kw)

    async def put(self, path: str, **kw: Any) -> httpx.Response:
        return await self.request("PUT", path, **kw)

    async def delete(self, path: str, **kw: Any) -> httpx.Response:
        return await self.request("DELETE", path, **kw)

    async def send(self, conversation_id: int, body: str, **extra: Any) -> dict[str, Any]:
        import uuid

        payload = {"client_id": uuid.uuid4().hex, "body": body, **extra}
        response = await self.post(f"/conversations/{conversation_id}/messages", json=payload)
        assert response.status_code == 201, response.text
        return response.json()

    async def open_direct(self, other: "Actor") -> int:
        response = await self.post("/conversations/direct", json={"user_id": other.id})
        assert response.status_code == 200, response.text
        return int(response.json()["id"])


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        _env_file=None,  # type: ignore[call-arg]
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'test.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        jwt_secret="test-secret-test-secret-test-secret-123",
        seed_on_startup=False,
        purge_interval_seconds=3600,
        presence_grace_seconds=0.01,
    )


@pytest.fixture
def realtime() -> FakeRealtime:
    return FakeRealtime()


@pytest.fixture
async def app(settings: Settings, realtime: FakeRealtime) -> AsyncIterator[FastAPI]:
    application = create_app(settings, realtime=realtime)  # type: ignore[arg-type]
    async with application.router.lifespan_context(application):
        yield application


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
        yield http


class UserFactory:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self.client = client
        self._next = 1

    async def create(self, name: str, *, phone: str | None = None) -> Actor:
        phone = phone or f"+1555010{self._next:04d}"
        self._next += 1
        response = await self.client.post(
            f"{API}/auth/verify-otp", json={"phone": phone, "code": OTP}
        )
        assert response.status_code == 200, response.text
        data = response.json()
        actor = Actor(self.client, data["user"]["id"], phone, data["token"])
        profile = await actor.patch("/users/me", json={"first_name": name})
        assert profile.status_code == 200, profile.text
        return actor


@pytest.fixture
def make_user(client: httpx.AsyncClient) -> UserFactory:
    return UserFactory(client)
