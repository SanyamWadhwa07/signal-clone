import uuid
from datetime import timedelta

from sqlalchemy import update

from app.models import Message
from app.models.base import utcnow
from tests.conftest import FakeRealtime, UserFactory

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


async def test_send_persists_and_notifies_every_member(
    make_user: UserFactory, realtime: FakeRealtime
) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    conversation_id = await alex.open_direct(bob)
    realtime.clear()

    message = await alex.send(conversation_id, "  Hello Bob  ")
    assert message["body"] == "Hello Bob"  # trimmed
    assert message["status"] == "sent"  # Bob is offline

    history = (await bob.get(f"/conversations/{conversation_id}/messages")).json()["items"]
    assert [m["body"] for m in history] == ["Hello Bob"]
    assert history[0]["status"] is None  # status only exists on your own messages

    assert realtime.received(bob.id, "message.new")[0]["message"]["body"] == "Hello Bob"
    assert realtime.received(alex.id, "message.new")  # echoed to the sender's other devices


async def test_send_is_idempotent_per_client_id(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    conversation_id = await alex.open_direct(bob)
    payload = {"client_id": uuid.uuid4().hex, "body": "once"}

    first = await alex.post(f"/conversations/{conversation_id}/messages", json=payload)
    retry = await alex.post(f"/conversations/{conversation_id}/messages", json=payload)
    assert (first.status_code, retry.status_code) == (201, 200)
    assert first.json()["id"] == retry.json()["id"]
    history = (await alex.get(f"/conversations/{conversation_id}/messages")).json()["items"]
    assert len(history) == 1


async def test_message_validation(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    conversation_id = await alex.open_direct(bob)
    url = f"/conversations/{conversation_id}/messages"

    blank = await alex.post(url, json={"client_id": uuid.uuid4().hex, "body": "   \n "})
    assert blank.status_code == 400
    assert blank.json()["error"]["code"] == "empty_message"

    too_long = await alex.post(url, json={"client_id": uuid.uuid4().hex, "body": "x" * 4001})
    assert too_long.status_code == 422


async def test_status_progresses_from_sent_to_delivered_to_read(
    make_user: UserFactory, realtime: FakeRealtime
) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    conversation_id = await alex.open_direct(bob)

    offline = await alex.send(conversation_id, "while Bob is away")
    assert offline["status"] == "sent"

    realtime.online.add(bob.id)
    online = await alex.send(conversation_id, "while Bob is here")
    assert online["status"] == "delivered"

    realtime.clear()
    read = await bob.post(f"/conversations/{conversation_id}/read", json={"up_to_id": online["id"]})
    assert read.json()["last_read_message_id"] == online["id"]

    updates = realtime.received(alex.id, "message.status")[0]["updates"]
    assert {u["id"]: u["status"] for u in updates} == {offline["id"]: "read", online["id"]: "read"}
    history = (await alex.get(f"/conversations/{conversation_id}/messages")).json()["items"]
    assert [m["status"] for m in history] == ["read", "read"]


async def test_read_receipts_can_be_disabled(
    make_user: UserFactory, realtime: FakeRealtime
) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    await bob.patch("/users/me", json={"settings": {"read_receipts": False}})
    conversation_id = await alex.open_direct(bob)
    message = await alex.send(conversation_id, "did you see this?")

    await bob.post(f"/conversations/{conversation_id}/read", json={"up_to_id": message["id"]})
    history = (await alex.get(f"/conversations/{conversation_id}/messages")).json()["items"]
    assert history[0]["status"] == "delivered"  # never "read"
    assert (await bob.get(f"/conversations/{conversation_id}")).json()["unread_count"] == 0


async def test_unread_count_and_read_marker_never_move_backwards(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    conversation_id = await alex.open_direct(bob)
    first = await alex.send(conversation_id, "one")
    second = await alex.send(conversation_id, "two")
    await alex.send(conversation_id, "three")
    assert (await bob.get(f"/conversations/{conversation_id}")).json()["unread_count"] == 3

    await bob.post(f"/conversations/{conversation_id}/read", json={"up_to_id": second["id"]})
    assert (await bob.get(f"/conversations/{conversation_id}")).json()["unread_count"] == 1

    again = await bob.post(f"/conversations/{conversation_id}/read", json={"up_to_id": first["id"]})
    assert again.json()["last_read_message_id"] == second["id"]
    assert (await alex.get(f"/conversations/{conversation_id}")).json()["unread_count"] == 0


async def test_pagination_walks_history_backwards_and_catches_up_forwards(
    make_user: UserFactory,
) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    conversation_id = await alex.open_direct(bob)
    sent = [(await alex.send(conversation_id, f"m{i}"))["id"] for i in range(7)]
    url = f"/conversations/{conversation_id}/messages"

    latest = (await alex.get(url, params={"limit": 3})).json()
    assert [m["id"] for m in latest["items"]] == sent[4:]
    assert latest["has_more"] is True

    older = (await alex.get(url, params={"limit": 3, "before_id": sent[4]})).json()
    assert [m["id"] for m in older["items"]] == sent[1:4]

    oldest = (await alex.get(url, params={"limit": 3, "before_id": sent[1]})).json()
    assert [m["id"] for m in oldest["items"]] == sent[:1]
    assert oldest["has_more"] is False

    newer = (await alex.get(url, params={"after_id": sent[4]})).json()
    assert [m["id"] for m in newer["items"]] == sent[5:]


async def test_reply_must_reference_a_message_in_the_same_chat(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    carla = await make_user.create("Carla")
    with_bob = await alex.open_direct(bob)
    with_carla = await alex.open_direct(carla)
    original = await alex.send(with_bob, "original")
    elsewhere = await alex.send(with_carla, "elsewhere")

    reply = await bob.send(with_bob, "got it", reply_to_id=original["id"])
    assert reply["reply_to"]["body"] == "original"

    wrong = await alex.post(
        f"/conversations/{with_bob}/messages",
        json={"client_id": uuid.uuid4().hex, "body": "x", "reply_to_id": elsewhere["id"]},
    )
    assert wrong.status_code == 400
    assert wrong.json()["error"]["code"] == "invalid_reply"


async def test_delete_for_everyone(make_user: UserFactory, realtime: FakeRealtime, app) -> None:  # type: ignore[no-untyped-def]
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    conversation_id = await alex.open_direct(bob)
    mine = await alex.send(conversation_id, "oops wrong chat")
    await bob.put(f"/messages/{mine['id']}/reaction", json={"emoji": "😮"})

    assert (await bob.delete(f"/messages/{mine['id']}")).status_code == 403
    realtime.clear()
    assert (await alex.delete(f"/messages/{mine['id']}")).status_code == 204
    assert realtime.received(bob.id, "message.deleted")[0]["message_id"] == mine["id"]

    shown = (await bob.get(f"/conversations/{conversation_id}/messages")).json()["items"][0]
    assert shown["deleted"] is True
    assert shown["body"] is None
    assert shown["reactions"] == []
    assert (await alex.delete(f"/messages/{mine['id']}")).status_code == 400  # already deleted

    old = await alex.send(conversation_id, "ancient")
    async with app.state.session_factory() as session:
        await session.execute(
            update(Message)
            .where(Message.id == old["id"])
            .values(created_at=utcnow() - timedelta(hours=25))
        )
        await session.commit()
    expired = await alex.delete(f"/messages/{old['id']}")
    assert expired.status_code == 403
    assert expired.json()["error"]["code"] == "delete_window_passed"


async def test_reactions_replace_and_clear(make_user: UserFactory, realtime: FakeRealtime) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    conversation_id = await alex.open_direct(bob)
    message = await alex.send(conversation_id, "react to me")

    await bob.put(f"/messages/{message['id']}/reaction", json={"emoji": "👍"})
    await bob.put(f"/messages/{message['id']}/reaction", json={"emoji": "❤️"})
    latest = realtime.received(alex.id, "reaction.updated")[-1]
    assert latest["reactions"] == [{"user_id": bob.id, "emoji": "❤️"}]  # one per user

    assert (
        await bob.put(f"/messages/{message['id']}/reaction", json={"emoji": "x"})
    ).status_code == 400
    await bob.delete(f"/messages/{message['id']}/reaction")
    history = (await alex.get(f"/conversations/{conversation_id}/messages")).json()["items"]
    assert history[0]["reactions"] == []


async def test_disappearing_messages_expire_and_are_purged(
    make_user: UserFactory,
    realtime: FakeRealtime,
    app,  # type: ignore[no-untyped-def]
) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    conversation_id = await alex.open_direct(bob)

    assert (
        await alex.patch(f"/conversations/{conversation_id}", json={"disappearing_seconds": 7})
    ).status_code == 422
    set_timer = await alex.patch(
        f"/conversations/{conversation_id}", json={"disappearing_seconds": 30}
    )
    assert set_timer.json()["disappearing_seconds"] == 30

    message = await alex.send(conversation_id, "this will vanish")
    assert message["expires_at"] is not None

    async with app.state.session_factory() as session:
        await session.execute(
            update(Message)
            .where(Message.id == message["id"])
            .values(expires_at=utcnow() - timedelta(seconds=1))
        )
        await session.commit()

    # Hidden immediately, even before the purge task runs.
    visible = (await bob.get(f"/conversations/{conversation_id}/messages")).json()["items"]
    assert all(m["id"] != message["id"] for m in visible)

    realtime.clear()
    async with app.state.session_factory() as session:
        purged = await app.state.container.messages(session).purge_expired()
    assert purged == 1
    assert realtime.received(bob.id, "message.expired")[0]["message_ids"] == [message["id"]]


async def test_attachment_flow(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    conversation_id = await alex.open_direct(bob)

    upload = await alex.post("/uploads", files={"file": ("pic.png", PNG, "image/png")})
    assert upload.status_code == 201
    attachment = upload.json()

    message = await alex.send(conversation_id, "look", attachment_id=attachment["id"])
    assert message["kind"] == "attachment"
    assert message["attachment"]["name"] == "pic.png"

    reuse = await alex.post(
        f"/conversations/{conversation_id}/messages",
        json={"client_id": uuid.uuid4().hex, "attachment_id": attachment["id"]},
    )
    assert reuse.status_code == 400  # an upload can only be attached once

    stolen = await bob.post(
        f"/conversations/{conversation_id}/messages",
        json={"client_id": uuid.uuid4().hex, "attachment_id": attachment["id"]},
    )
    assert stolen.status_code == 400


async def test_upload_validation(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")

    exe = await alex.post(
        "/uploads", files={"file": ("virus.exe", b"MZ", "application/octet-stream")}
    )
    assert exe.json()["error"]["code"] == "unsupported_type"

    fake_png = await alex.post("/uploads", files={"file": ("pic.png", b"not a png", "image/png")})
    assert fake_png.json()["error"]["code"] == "unsupported_type"

    traversal = await alex.post(
        "/uploads", files={"file": ("../../etc/x.txt", b"hi", "text/plain")}
    )
    assert traversal.status_code == 201
    assert traversal.json()["name"] == "x.txt"

    big = await alex.post(
        "/uploads", files={"file": ("big.txt", b"a" * (10 * 1024 * 1024 + 1), "text/plain")}
    )
    assert big.status_code == 413
