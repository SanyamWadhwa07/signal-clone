import httpx

from tests.conftest import API, OTP, UserFactory


async def test_request_otp_gives_same_answer_for_any_phone(client: httpx.AsyncClient) -> None:
    known = await client.post(f"{API}/auth/request-otp", json={"phone": "+15550109999"})
    other = await client.post(f"{API}/auth/request-otp", json={"phone": "+442071838750"})
    assert known.status_code == other.status_code == 200
    assert OTP in known.json()["hint"]


async def test_invalid_phone_is_rejected(client: httpx.AsyncClient) -> None:
    response = await client.post(f"{API}/auth/request-otp", json={"phone": "12345"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


async def test_phone_is_normalized_to_e164(client: httpx.AsyncClient) -> None:
    response = await client.post(
        f"{API}/auth/verify-otp", json={"phone": "+91 98765-43210", "code": OTP}
    )
    assert response.json()["user"]["phone"] == "+919876543210"


async def test_wrong_code_is_rejected(client: httpx.AsyncClient) -> None:
    response = await client.post(
        f"{API}/auth/verify-otp", json={"phone": "+15550100001", "code": "000000"}
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_code"


async def test_new_user_must_finish_profile_and_returning_user_keeps_account(
    client: httpx.AsyncClient,
) -> None:
    first = await client.post(f"{API}/auth/verify-otp", json={"phone": "+15550100001", "code": OTP})
    assert first.json()["needs_profile"] is True

    headers = {"Authorization": f"Bearer {first.json()['token']}"}
    await client.patch(f"{API}/users/me", json={"first_name": "Alex"}, headers=headers)

    again = await client.post(f"{API}/auth/verify-otp", json={"phone": "+15550100001", "code": OTP})
    assert again.json()["needs_profile"] is False
    assert again.json()["user"]["id"] == first.json()["user"]["id"]


async def test_first_name_cannot_be_blank(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    response = await alex.patch("/users/me", json={"first_name": "   "})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "first_name_required"


async def test_protected_routes_need_a_token(client: httpx.AsyncClient) -> None:
    assert (await client.get(f"{API}/conversations")).status_code == 401
    bad = await client.get(f"{API}/conversations", headers={"Authorization": "Bearer nope"})
    assert bad.status_code == 401


async def test_logout_revokes_only_that_session(
    client: httpx.AsyncClient, make_user: UserFactory
) -> None:
    alex = await make_user.create("Alex")
    second = await client.post(f"{API}/auth/verify-otp", json={"phone": alex.phone, "code": OTP})
    other_headers = {"Authorization": f"Bearer {second.json()['token']}"}

    assert (await alex.post("/auth/logout")).status_code == 204
    assert (await alex.get("/auth/me")).status_code == 401
    assert (await client.get(f"{API}/auth/me", headers=other_headers)).status_code == 200


async def test_username_is_unique_and_validated(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    bob = await make_user.create("Bob")
    assert (await alex.patch("/users/me", json={"username": "Alex_R.01"})).json()[
        "username"
    ] == "alex_r.01"

    taken = await bob.patch("/users/me", json={"username": "alex_r.01"})
    assert taken.status_code == 409
    assert taken.json()["error"]["code"] == "username_taken"
    assert (await bob.patch("/users/me", json={"username": "x"})).status_code == 422


async def test_privacy_settings_are_stored(make_user: UserFactory) -> None:
    alex = await make_user.create("Alex")
    response = await alex.patch("/users/me", json={"settings": {"read_receipts": False}})
    assert response.json()["settings"] == {"read_receipts": False, "typing_indicators": True}
