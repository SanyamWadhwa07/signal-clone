"""End-to-end realtime tests over a real WebSocket, using Starlette's synchronous TestClient."""

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.core.config import Settings
from app.main import create_app

API = "/api/v1"


@pytest.fixture
def http(tmp_path: Path) -> Iterator[TestClient]:
    settings = Settings(
        _env_file=None,  # type: ignore[call-arg]
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'ws.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        jwt_secret="test-secret-test-secret-test-secret-123",
        seed_on_startup=False,
        purge_interval_seconds=3600,
        presence_grace_seconds=0.05,
    )
    with TestClient(create_app(settings)) as client:
        yield client


def signup(http: TestClient, phone: str, name: str) -> dict[str, Any]:
    data = http.post(f"{API}/auth/verify-otp", json={"phone": phone, "code": "123456"}).json()
    headers = {"Authorization": f"Bearer {data['token']}"}
    http.patch(f"{API}/users/me", json={"first_name": name}, headers=headers)
    return {"id": data["user"]["id"], "token": data["token"], "headers": headers}


def connect(http: TestClient, token: str) -> Any:
    socket = http.websocket_connect("/ws")
    ws = socket.__enter__()
    ws.send_json({"type": "auth", "token": token})
    assert ws.receive_json()["type"] == "ready"
    return socket, ws


def next_of(ws: Any, event: str, limit: int = 10) -> dict[str, Any]:
    for _ in range(limit):
        frame = ws.receive_json()
        if frame["type"] == event:
            return frame["payload"]
    raise AssertionError(f"never received {event}")


def test_rejects_bad_token(http: TestClient) -> None:
    with http.websocket_connect("/ws") as ws:
        ws.send_json({"type": "auth", "token": "garbage"})
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_json()
    assert closed.value.code == 4401


def test_rejects_non_auth_first_frame(http: TestClient) -> None:
    with http.websocket_connect("/ws") as ws:
        ws.send_json({"type": "ping"})
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_json()
    assert closed.value.code == 4401


def test_message_is_pushed_in_real_time_and_delivery_is_instant(http: TestClient) -> None:
    alex, bob = signup(http, "+15550100001", "Alex"), signup(http, "+15550100002", "Bob")
    conversation_id = http.post(
        f"{API}/conversations/direct", json={"user_id": bob["id"]}, headers=alex["headers"]
    ).json()["id"]

    bob_socket, bob_ws = connect(http, bob["token"])
    alex_socket, alex_ws = connect(http, alex["token"])
    try:
        sent = http.post(
            f"{API}/conversations/{conversation_id}/messages",
            json={"client_id": "client-id-0001", "body": "live!"},
            headers=alex["headers"],
        ).json()
        assert sent["status"] == "delivered"  # Bob had a live socket
        pushed = next_of(bob_ws, "message.new")["message"]
        assert pushed["body"] == "live!" and pushed["status"] is None

        http.post(
            f"{API}/conversations/{conversation_id}/read",
            json={"up_to_id": sent["id"]},
            headers=bob["headers"],
        )
        update = next_of(alex_ws, "message.status")
        assert update["updates"] == [{"id": sent["id"], "status": "read"}]
    finally:
        alex_socket.__exit__(None, None, None)
        bob_socket.__exit__(None, None, None)


def test_offline_messages_become_delivered_when_the_recipient_connects(http: TestClient) -> None:
    alex, bob = signup(http, "+15550100001", "Alex"), signup(http, "+15550100002", "Bob")
    conversation_id = http.post(
        f"{API}/conversations/direct", json={"user_id": bob["id"]}, headers=alex["headers"]
    ).json()["id"]
    sent = http.post(
        f"{API}/conversations/{conversation_id}/messages",
        json={"client_id": "client-id-0002", "body": "are you there?"},
        headers=alex["headers"],
    ).json()
    assert sent["status"] == "sent"

    alex_socket, alex_ws = connect(http, alex["token"])
    bob_socket, _ = connect(http, bob["token"])
    try:
        update = next_of(alex_ws, "message.status")
        assert update["updates"] == [{"id": sent["id"], "status": "delivered"}]
    finally:
        bob_socket.__exit__(None, None, None)
        alex_socket.__exit__(None, None, None)


def test_typing_is_relayed_to_other_members_only(http: TestClient) -> None:
    alex, bob = signup(http, "+15550100001", "Alex"), signup(http, "+15550100002", "Bob")
    conversation_id = http.post(
        f"{API}/conversations/direct", json={"user_id": bob["id"]}, headers=alex["headers"]
    ).json()["id"]

    alex_socket, alex_ws = connect(http, alex["token"])
    bob_socket, bob_ws = connect(http, bob["token"])
    try:
        alex_ws.send_json(
            {"type": "typing", "payload": {"conversation_id": conversation_id, "is_typing": True}}
        )
        typing = next_of(bob_ws, "typing")
        assert typing == {
            "conversation_id": conversation_id,
            "user_id": alex["id"],
            "is_typing": True,
        }

        # Someone outside the chat can't inject typing events into it.
        mallory = signup(http, "+15550100003", "Mallory")
        mallory_socket, mallory_ws = connect(http, mallory["token"])
        mallory_ws.send_json(
            {"type": "typing", "payload": {"conversation_id": conversation_id, "is_typing": True}}
        )
        mallory_ws.send_json({"type": "ping"})
        assert next_of(mallory_ws, "pong") == {}
        mallory_socket.__exit__(None, None, None)
    finally:
        bob_socket.__exit__(None, None, None)
        alex_socket.__exit__(None, None, None)


def test_typing_is_suppressed_when_the_user_disabled_indicators(http: TestClient) -> None:
    alex, bob = signup(http, "+15550100001", "Alex"), signup(http, "+15550100002", "Bob")
    http.patch(
        f"{API}/users/me", json={"settings": {"typing_indicators": False}}, headers=alex["headers"]
    )
    conversation_id = http.post(
        f"{API}/conversations/direct", json={"user_id": bob["id"]}, headers=alex["headers"]
    ).json()["id"]

    alex_socket, alex_ws = connect(http, alex["token"])
    bob_socket, bob_ws = connect(http, bob["token"])
    try:
        alex_ws.send_json(
            {"type": "typing", "payload": {"conversation_id": conversation_id, "is_typing": True}}
        )
        bob_ws.send_json({"type": "ping"})
        assert next_of(bob_ws, "pong") == {}  # the next frame is our pong, not a typing event
    finally:
        bob_socket.__exit__(None, None, None)
        alex_socket.__exit__(None, None, None)


def test_presence_is_broadcast_to_people_who_share_a_chat(http: TestClient) -> None:
    alex, bob = signup(http, "+15550100001", "Alex"), signup(http, "+15550100002", "Bob")
    http.post(f"{API}/conversations/direct", json={"user_id": bob["id"]}, headers=alex["headers"])

    bob_socket, bob_ws = connect(http, bob["token"])
    alex_socket, _ = connect(http, alex["token"])
    try:
        online = next_of(bob_ws, "presence")
        assert online["user_id"] == alex["id"] and online["online"] is True
    finally:
        alex_socket.__exit__(None, None, None)
    offline = next_of(bob_ws, "presence")
    assert offline["user_id"] == alex["id"] and offline["online"] is False
    assert offline["last_seen_at"] is not None
    bob_socket.__exit__(None, None, None)
