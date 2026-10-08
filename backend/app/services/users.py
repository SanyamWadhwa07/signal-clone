from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, bad_request, not_found
from app.models import User
from app.realtime import events
from app.realtime.publisher import EventPublisher, PresenceTracker
from app.repositories.users import UserRepository
from app.schemas.common import normalize_phone
from app.schemas.user import UpdateMeRequest, UserPublic
from app.services.presenters import user_public


class UserService:
    def __init__(
        self,
        session: AsyncSession,
        users: UserRepository,
        publisher: EventPublisher,
        presence: PresenceTracker,
    ) -> None:
        self.session = session
        self.users = users
        self.publisher = publisher
        self.presence = presence

    async def update_me(self, user: User, patch: UpdateMeRequest) -> User:
        fields = patch.model_fields_set

        if "first_name" in fields:
            if patch.first_name is None:
                raise bad_request("first_name_required", "First name is required.")
            user.first_name = patch.first_name
        if "last_name" in fields:
            user.last_name = patch.last_name
        if "about" in fields:
            user.about = patch.about
        if "avatar_url" in fields:
            user.avatar_url = patch.avatar_url
        if "username" in fields:
            await self._set_username(user, patch.username)
        if patch.settings is not None:
            user.settings = {
                **(user.settings or {}),
                **patch.settings.model_dump(exclude_none=True),
            }

        await self.session.commit()
        await self._broadcast_profile(user)
        return user

    async def _set_username(self, user: User, username: str | None) -> None:
        if username is not None:
            existing = await self.users.get_by_username(username)
            if existing is not None and existing.id != user.id:
                raise AppError(409, "username_taken", "That username is already taken.")
        user.username = username

    async def _broadcast_profile(self, user: User) -> None:
        audience = await self.users.audience_ids(user.id) | {user.id}
        await self.publisher.publish(
            audience,
            events.USER_UPDATED,
            user_public(user, online=self.presence.is_online(user.id)),
        )

    async def lookup(self, *, phone: str | None, username: str | None) -> UserPublic:
        if bool(phone) == bool(username):
            raise bad_request("invalid_lookup", "Provide either a phone number or a username.")
        if phone:
            try:
                user = await self.users.get_by_phone(normalize_phone(phone))
            except ValueError as exc:
                raise bad_request("invalid_phone", str(exc)) from exc
        else:
            user = await self.users.get_by_username((username or "").lower())
        if user is None or user.first_name is None:
            raise not_found("This person isn't using Signal.")
        return user_public(user, online=self.presence.is_online(user.id))
