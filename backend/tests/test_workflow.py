"""The assignment's whole user journey, in order, through the public API only.

Each step asserts what the brief asks for; the more detailed behaviour lives in the focused test
modules. If this passes, a reviewer clicking through the app will see the same thing.
"""

from tests.conftest import FakeRealtime, UserFactory

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


async def test_signal_clone_happy_path(make_user: UserFactory, realtime: FakeRealtime) -> None:
    # 1. Authentication / onboarding: register by phone (mock OTP), set name, session works
    sanyam = await make_user.create("Sanyam", phone="+919876500001")
    aarav = await make_user.create("Aarav", phone="+919876500002")
    simran = await make_user.create("Simran", phone="+919876500003")
    me = (await sanyam.get("/auth/me")).json()
    assert me["first_name"] == "Sanyam" and me["phone"] == "+919876500001"

    # 2. Contacts: add one by phone, look another up, list them
    assert (
        await sanyam.post("/contacts", json={"phone": aarav.phone, "nickname": "Bro"})
    ).status_code == 201
    found = await sanyam.get("/users/lookup", params={"phone": simran.phone})
    assert found.json()["first_name"] == "Simran"
    assert [c["nickname"] for c in (await sanyam.get("/contacts")).json()] == ["Bro"]

    # 3. One-on-one messaging: open a DM, send, deliver, read (the tick progression)
    dm = await sanyam.open_direct(aarav)
    realtime.online.add(aarav.id)
    sent = await sanyam.send(dm, "Hello Aarav!")
    assert sent["status"] == "delivered"  # Aarav has a live connection
    assert realtime.received(aarav.id, "message.new")[-1]["message"]["body"] == "Hello Aarav!"

    chats = (await aarav.get("/conversations")).json()
    assert chats[0]["unread_count"] == 1 and chats[0]["last_message"]["body"] == "Hello Aarav!"
    await aarav.post(f"/conversations/{dm}/read", json={"up_to_id": sent["id"]})
    history = (await sanyam.get(f"/conversations/{dm}/messages")).json()["items"]
    assert history[0]["status"] == "read"
    assert (await aarav.get(f"/conversations/{dm}")).json()["unread_count"] == 0

    # ...with a reply, a reaction and an attachment
    reply = await aarav.send(dm, "Hi Sanyam", reply_to_id=sent["id"])
    assert reply["reply_to"]["body"] == "Hello Aarav!"
    assert (
        await sanyam.put(f"/messages/{reply['id']}/reaction", json={"emoji": "👍"})
    ).status_code == 204
    upload = await sanyam.post("/uploads", files={"file": ("photo.png", PNG, "image/png")})
    photo = await sanyam.send(dm, "Look", attachment_id=upload.json()["id"])
    assert photo["attachment"]["name"] == "photo.png"

    # 4. Groups: create, message, admin controls, members, leave
    group = (await sanyam.post("/groups", json={"name": "Trek", "member_ids": [aarav.id]})).json()
    gid = group["id"]
    assert (
        await simran.post(f"/groups/{gid}/members", json={"user_ids": [simran.id]})
    ).status_code == 404
    assert (
        await aarav.post(f"/groups/{gid}/members", json={"user_ids": [simran.id]})
    ).status_code == 403
    added = await sanyam.post(f"/groups/{gid}/members", json={"user_ids": [simran.id]})
    assert {m["user"]["first_name"] for m in added.json()} == {"Sanyam", "Aarav", "Simran"}
    await simran.send(gid, "Count me in")
    assert (await aarav.get(f"/conversations/{gid}")).json()["last_message"][
        "body"
    ] == "Count me in"
    assert (
        await sanyam.patch(f"/groups/{gid}/members/{aarav.id}", json={"role": "admin"})
    ).status_code == 204
    assert (await sanyam.delete(f"/groups/{gid}/members/{simran.id}")).status_code == 204
    assert (
        await simran.get(f"/conversations/{gid}")
    ).status_code == 404  # removed members lose access

    # 5. Signal experience extras: search, disappearing messages, delete for everyone
    hits = (await sanyam.get("/search", params={"q": "Hello"})).json()
    assert [m["conversation_id"] for m in hits["messages"]] == [dm]
    timer = await sanyam.patch(f"/conversations/{dm}", json={"disappearing_seconds": 300})
    assert timer.json()["disappearing_seconds"] == 300
    expiring = await sanyam.send(dm, "This disappears")
    assert expiring["expires_at"] is not None
    assert (await sanyam.delete(f"/messages/{photo['id']}")).status_code == 204

    # 6. Settings / privacy and logout
    updated = await sanyam.patch("/users/me", json={"settings": {"typing_indicators": False}})
    assert updated.json()["settings"]["typing_indicators"] is False
    assert (await sanyam.post("/auth/logout")).status_code == 204
    assert (await sanyam.get("/conversations")).status_code == 401  # the session is really gone

    # ...and the data persists: signing in again shows the same chats
    again = await make_user.client.post(
        "/api/v1/auth/verify-otp", json={"phone": sanyam.phone, "code": "123456"}
    )
    headers = {"Authorization": f"Bearer {again.json()['token']}"}
    after = (await make_user.client.get("/api/v1/conversations", headers=headers)).json()
    assert {c["id"] for c in after} == {dm, gid}
