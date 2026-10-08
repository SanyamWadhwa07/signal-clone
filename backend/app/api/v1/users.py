from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, UserSvc
from app.schemas.user import UpdateMeRequest, UserMe, UserPublic
from app.services.presenters import user_me

router = APIRouter(prefix="/users", tags=["users"])


@router.patch("/me", response_model=UserMe)
async def update_me(body: UpdateMeRequest, user: CurrentUser, service: UserSvc) -> UserMe:
    return user_me(await service.update_me(user, body))


@router.get("/lookup", response_model=UserPublic)
async def lookup(
    _: CurrentUser,
    service: UserSvc,
    phone: str | None = Query(default=None, max_length=30),
    username: str | None = Query(default=None, max_length=40),
) -> UserPublic:
    return await service.lookup(phone=phone, username=username)
