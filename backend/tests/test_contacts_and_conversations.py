from tests.conftest import UserFactory


async def test_add_contact_by_phone_and_username(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    carla = await make_user.create("Carla")
    await carla.patch("/users/me", json={"username": "carla_d.12"})

    by_phone = await alex.post("/contacts", json={"phone": bob.phone, "nickname": "Bobby"})
    assert by_phone.status_code == 201
    assert by_phone.json()["nickname"] == "Bobby"

    by_username = await alex.post("/contacts", json={"username": "carla_d.12"})
    assert by_username.status_code == 201

    names = [c["user"]["first_name"] for c in (await alex.get("/contacts")).json()]
    assert names == ["Bob", "Carla"] or names == ["Carla", "Bob"]


async def test_add_contact_edge_cases(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")

    missing = await alex.post("/contacts", json={"phone": "+15559999999"})
    assert missing.status_code == 404

    myself = await alex.post("/contacts", json={"phone": alex.phone})
    assert myself.status_code == 400
    assert myself.json()["error"]["code"] == "cannot_add_self"

    assert (await alex.post("/contacts", json={})).status_code == 422
    assert (
        await alex.post("/contacts", json={"phone": bob.phone, "username": "x_y_z"})
    ).status_code == 422

    first = await alex.post("/contacts", json={"phone": bob.phone})
    again = await alex.post("/contacts", json={"phone": bob.phone, "nickname": "B"})
    assert (first.status_code, again.status_code) == (201, 200)
    assert again.json()["id"] == first.json()["id"]
    assert again.json()["nickname"] == "B"


async def test_update_and_delete_contact_only_for_owner(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    contact = (await alex.post("/contacts", json={"phone": bob.phone})).json()

    assert (await bob.delete(f"/contacts/{contact['id']}")).status_code == 404
    assert (
        await alex.patch(f"/contacts/{contact['id']}", json={"nickname": "Bro"})
    ).status_code == 200
    assert (await alex.delete(f"/contacts/{contact['id']}")).status_code == 204
    assert (await alex.get("/contacts")).json() == []


async def test_lookup_user(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    found = await alex.get("/users/lookup", params={"phone": bob.phone})
    assert found.json()["first_name"] == "Bob"
    assert (await alex.get("/users/lookup", params={"phone": "+15558888888"})).status_code == 404
    assert (await alex.get("/users/lookup")).status_code == 400


async def test_direct_conversation_is_unique_per_pair(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    from_alex = await alex.open_direct(bob)
    from_bob = await bob.open_direct(alex)
    assert from_alex == from_bob
    assert await alex.open_direct(bob) == from_alex


async def test_note_to_self(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    note = await alex.open_direct(alex)
    message = await alex.send(note, "Remember the milk")
    assert message["status"] == "read"  # no recipients -> nothing left to deliver
    conversation = (await alex.get(f"/conversations/{note}")).json()
    assert conversation["peer"]["id"] == alex.id
    assert conversation["unread_count"] == 0


async def test_empty_direct_chat_is_hidden_from_the_recipient_until_a_message_exists(
    make_user: UserFactory,
) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    conversation_id = await alex.open_direct(bob)

    assert [c["id"] for c in (await alex.get("/conversations")).json()] == [conversation_id]
    assert (await bob.get("/conversations")).json() == []

    await alex.send(conversation_id, "hi")
    assert [c["id"] for c in (await bob.get("/conversations")).json()] == [conversation_id]


async def test_conversations_are_sorted_by_latest_activity(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    carla = await make_user.create("Carla")
    with_bob = await alex.open_direct(bob)
    with_carla = await alex.open_direct(carla)
    await alex.send(with_bob, "first")
    await alex.send(with_carla, "second")
    assert [c["id"] for c in (await alex.get("/conversations")).json()] == [with_carla, with_bob]

    await alex.send(with_bob, "third")
    assert [c["id"] for c in (await alex.get("/conversations")).json()] == [with_bob, with_carla]


async def test_non_members_get_404_not_403(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    mallory = await make_user.create("Mallory")
    conversation_id = await alex.open_direct(bob)
    await alex.send(conversation_id, "secret")

    assert (await mallory.get(f"/conversations/{conversation_id}")).status_code == 404
    assert (await mallory.get(f"/conversations/{conversation_id}/messages")).status_code == 404
    send = await mallory.post(
        f"/conversations/{conversation_id}/messages",
        json={"client_id": "abcdefgh1234", "body": "hi"},
    )
    assert send.status_code == 404


async def test_search_finds_chats_contacts_and_messages(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    await alex.post("/contacts", json={"phone": bob.phone, "nickname": "Robert"})
    conversation_id = await alex.open_direct(bob)
    await alex.send(conversation_id, "Lunch at the 100% vegan place?")

    result = (await alex.get("/search", params={"q": "robert"})).json()
    assert len(result["contacts"]) == 1

    result = (await alex.get("/search", params={"q": "vegan"})).json()
    assert [m["conversation_id"] for m in result["messages"]] == [conversation_id]

    # LIKE wildcards in the query are escaped, not interpreted.
    assert (await alex.get("/search", params={"q": "100%"})).json()["messages"]
    assert (await alex.get("/search", params={"q": "%%"})).json()["messages"] == []
    assert (await alex.get("/search", params={"q": "v"})).json()["messages"] == []


async def test_new_accounts_start_with_the_demo_people_as_contacts_but_no_chats(
    make_user: UserFactory,
) -> None:
    aarav = await make_user.create("Aarav", phone="+919876500002")
    simran = await make_user.create("Simran", phone="+919876500003")
    reviewer = await make_user.create("Reviewer", phone="+14155550123")

    contacts = (await reviewer.get("/contacts")).json()
    assert {c["user"]["first_name"] for c in contacts} == {"Aarav", "Simran"}

    chats = (await reviewer.get("/conversations")).json()
    assert (chats["items"] if isinstance(chats, dict) else chats) == []

    # They can message a demo person immediately.
    chat_id = await reviewer.open_direct(aarav)
    assert (await reviewer.send(chat_id, "hello from a new account"))["body"]
    assert simran.id != reviewer.id


async def test_ordinary_users_are_not_added_to_contacts_automatically(
    make_user: UserFactory,
) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    assert (await bob.get("/contacts")).json() == []
    assert alex.id != bob.id


async def test_profile_edits_do_not_re_add_demo_contacts(make_user: UserFactory) -> None:
    await make_user.create("Aarav", phone="+919876500002")
    reviewer = await make_user.create("Reviewer", phone="+14155550124")
    contact_id = (await reviewer.get("/contacts")).json()[0]["id"]
    await reviewer.delete(f"/contacts/{contact_id}")

    await reviewer.patch("/users/me", json={"about": "Just testing"})
    assert (await reviewer.get("/contacts")).json() == []
