from tests.conftest import Actor, FakeRealtime, UserFactory


async def make_group(admin: Actor, name: str, *members: Actor) -> int:
    response = await admin.post(
        "/groups", json={"name": name, "member_ids": [m.id for m in members]}
    )
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


async def members_of(actor: Actor, group_id: int) -> dict[int, str]:
    rows = (await actor.get(f"/groups/{group_id}/members")).json()
    return {row["user"]["id"]: row["role"] for row in rows}


async def test_create_group(make_user: UserFactory, realtime: FakeRealtime) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    carla = await make_user.create("Carla")

    response = await alex.post(
        "/groups", json={"name": "  Hikers  ", "member_ids": [bob.id, carla.id, bob.id, alex.id]}
    )
    group = response.json()
    assert group["name"] == "Hikers"
    assert group["member_count"] == 3  # duplicates and the creator are de-duplicated
    assert group["my_role"] == "admin"

    group_id = group["id"]
    assert await members_of(alex, group_id) == {
        alex.id: "admin",
        bob.id: "member",
        carla.id: "member",
    }
    # Every member is told about the new group through the "created" system message.
    created = realtime.received(bob.id, "message.new")[0]["message"]
    assert created["kind"] == "system"
    assert created["meta"]["event"] == "created"
    assert (await bob.get("/conversations")).json()[0]["id"] == group_id


async def test_group_validation(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    assert (await alex.post("/groups", json={"name": "x", "member_ids": []})).status_code == 422
    assert (
        await alex.post("/groups", json={"name": "   ", "member_ids": [bob.id]})
    ).status_code == 422
    assert (
        await alex.post("/groups", json={"name": "x" * 33, "member_ids": [bob.id]})
    ).status_code == 422
    only_self = await alex.post("/groups", json={"name": "Solo", "member_ids": [alex.id]})
    assert only_self.json()["error"]["code"] == "no_members"
    unknown = await alex.post("/groups", json={"name": "Ghosts", "member_ids": [9999]})
    assert unknown.status_code == 404


async def test_group_messages_reach_everyone_with_aggregate_status(
    make_user: UserFactory, realtime: FakeRealtime
) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    carla = await make_user.create("Carla")
    group_id = await make_group(alex, "Trio", bob, carla)

    realtime.online.update({bob.id, carla.id})
    message = await alex.send(group_id, "hello all")
    assert message["status"] == "delivered"

    await bob.post(f"/conversations/{group_id}/read", json={"up_to_id": message["id"]})
    assert (await alex.get(f"/conversations/{group_id}/messages")).json()["items"][-1][
        "status"
    ] == "delivered"

    await carla.post(f"/conversations/{group_id}/read", json={"up_to_id": message["id"]})
    assert (await alex.get(f"/conversations/{group_id}/messages")).json()["items"][-1][
        "status"
    ] == "read"


async def test_only_admins_manage_members_and_info(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    carla = await make_user.create("Carla")
    dev = await make_user.create("Dev")
    group_id = await make_group(alex, "Team", bob, carla)

    add = await bob.post(f"/groups/{group_id}/members", json={"user_ids": [dev.id]})
    assert add.status_code == 403
    assert (await bob.delete(f"/groups/{group_id}/members/{carla.id}")).status_code == 403
    assert (await bob.patch(f"/conversations/{group_id}", json={"name": "Hax"})).status_code == 403
    assert (
        await bob.patch(f"/groups/{group_id}/members/{bob.id}", json={"role": "admin"})
    ).status_code == 403

    assert (
        await alex.post(f"/groups/{group_id}/members", json={"user_ids": [dev.id]})
    ).status_code == 200
    renamed = await alex.patch(f"/conversations/{group_id}", json={"name": "Squad"})
    assert renamed.json()["name"] == "Squad"
    assert (await alex.delete(f"/groups/{group_id}/members/{carla.id}")).status_code == 204
    assert set(await members_of(alex, group_id)) == {alex.id, bob.id, dev.id}


async def test_admin_cannot_remove_self_or_demote_the_last_admin(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    group_id = await make_group(alex, "Pair", bob)

    assert (await alex.delete(f"/groups/{group_id}/members/{alex.id}")).json()["error"][
        "code"
    ] == "use_leave"
    demote = await alex.patch(f"/groups/{group_id}/members/{alex.id}", json={"role": "member"})
    assert demote.json()["error"]["code"] == "last_admin"

    await alex.patch(f"/groups/{group_id}/members/{bob.id}", json={"role": "admin"})
    assert (
        await alex.patch(f"/groups/{group_id}/members/{alex.id}", json={"role": "member"})
    ).status_code == 204
    assert (await members_of(bob, group_id))[alex.id] == "member"


async def test_adding_existing_members_is_skipped_and_unknown_users_rejected(
    make_user: UserFactory,
) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    group_id = await make_group(alex, "Pair", bob)
    again = await alex.post(f"/groups/{group_id}/members", json={"user_ids": [bob.id]})
    assert again.status_code == 200
    assert len(again.json()) == 2
    assert (
        await alex.post(f"/groups/{group_id}/members", json={"user_ids": [4242]})
    ).status_code == 404


async def test_new_members_do_not_see_earlier_history(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    carla = await make_user.create("Carla")
    group_id = await make_group(alex, "Pair", bob)
    await alex.send(group_id, "before carla")

    await alex.post(f"/groups/{group_id}/members", json={"user_ids": [carla.id]})
    await alex.send(group_id, "after carla")

    seen = (await carla.get(f"/conversations/{group_id}/messages")).json()["items"]
    assert [m["body"] for m in seen if m["kind"] == "text"] == ["after carla"]
    conversation = (await carla.get(f"/conversations/{group_id}")).json()
    assert conversation["unread_count"] == 1  # only what arrived after joining


async def test_removed_member_loses_access_and_is_notified(
    make_user: UserFactory, realtime: FakeRealtime
) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    group_id = await make_group(alex, "Pair", bob)
    realtime.clear()

    await alex.delete(f"/groups/{group_id}/members/{bob.id}")
    assert realtime.received(bob.id, "conversation.removed")[0]["reason"] == "removed"
    assert (await bob.get(f"/conversations/{group_id}")).status_code == 404
    assert (await bob.get("/conversations")).json() == []
    send = await bob.post(
        f"/conversations/{group_id}/messages", json={"client_id": "abcdefgh1234", "body": "hi"}
    )
    assert send.status_code == 404


async def test_removing_a_member_completes_pending_statuses(
    make_user: UserFactory, realtime: FakeRealtime
) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    carla = await make_user.create("Carla")
    group_id = await make_group(alex, "Trio", bob, carla)
    message = await alex.send(group_id, "ping")
    await bob.post(f"/conversations/{group_id}/read", json={"up_to_id": message["id"]})

    async def status_of_ping() -> str | None:
        items = (await alex.get(f"/conversations/{group_id}/messages")).json()["items"]
        return next(m["status"] for m in items if m["id"] == message["id"])

    # Carla never read it, so the message is stuck below "read" until she's gone.
    assert await status_of_ping() == "sent"
    realtime.clear()
    await alex.delete(f"/groups/{group_id}/members/{carla.id}")
    assert await status_of_ping() == "read"
    update = realtime.received(alex.id, "message.status")[0]["updates"]
    assert {"id": message["id"], "status": "read"} in update


async def test_last_admin_leaving_promotes_longest_standing_member(
    make_user: UserFactory,
) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    carla = await make_user.create("Carla")
    group_id = await make_group(alex, "Trio", bob, carla)

    assert (await alex.post(f"/groups/{group_id}/leave")).status_code == 204
    roles = await members_of(bob, group_id)
    assert alex.id not in roles
    assert "admin" in roles.values()  # somebody inherited the group


async def test_direct_chats_cannot_use_group_endpoints(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    carla = await make_user.create("Carla")
    direct = await alex.open_direct(bob)
    assert (
        await alex.post(f"/groups/{direct}/members", json={"user_ids": [carla.id]})
    ).status_code == 400
    assert (await alex.post(f"/groups/{direct}/leave")).status_code == 400
    assert (await alex.patch(f"/conversations/{direct}", json={"name": "Nope"})).status_code == 400


async def test_group_admin_can_delete_any_members_message(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    carla = await make_user.create("Carla")
    group_id = await make_group(alex, "Trio", bob, carla)
    spam = await bob.send(group_id, "buy my stuff")

    assert (await carla.delete(f"/messages/{spam['id']}")).status_code == 403
    assert (await alex.delete(f"/messages/{spam['id']}")).status_code == 204
    shown = [
        m
        for m in (await carla.get(f"/conversations/{group_id}/messages")).json()["items"]
        if m["id"] == spam["id"]
    ]
    assert shown[0]["deleted"] is True
    assert shown[0]["meta"] == {"deleted_by": alex.id}


async def test_only_admins_set_group_timer_but_anyone_in_a_dm_can(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    group_id = await make_group(alex, "Pair", bob)
    assert (
        await bob.patch(f"/conversations/{group_id}", json={"disappearing_seconds": 30})
    ).status_code == 403
    assert (
        await alex.patch(f"/conversations/{group_id}", json={"disappearing_seconds": 30})
    ).status_code == 200

    direct = await alex.open_direct(bob)
    assert (
        await bob.patch(f"/conversations/{direct}", json={"disappearing_seconds": 30})
    ).status_code == 200
    off = await bob.patch(f"/conversations/{direct}", json={"disappearing_seconds": 0})
    assert off.json()["disappearing_seconds"] is None
