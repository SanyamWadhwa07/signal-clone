from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, bad_request, not_found
from app.models import Contact, User
from app.realtime import events
from app.realtime.publisher import EventPublisher, PresenceTracker
from app.repositories.contacts import ContactRepository
from app.repositories.users import UserRepository
from app.schemas.common import normalize_phone
from app.schemas.user import UpdateMeRequest, UserPublic
from app.services.presenters import user_public


class UserService:
    def __init__(
        self,
        session: AsyncSession,
        users: UserRepository,
        contacts: ContactRepository,
        publisher: EventPublisher,
        presence: PresenceTracker,
        welcome_contact_phones: Sequence[str] = (),
    ) -> None:
        self.session = session
        self.users = users
        self.contacts = contacts
        self.welcome_contact_phones = welcome_contact_phones
        self.publisher = publisher
        self.presence = presence

    async def update_me(self, user: User, patch: UpdateMeRequest) -> User:
        fields = patch.model_fields_set
        finishing_onboarding = user.first_name is None and "first_name" in fields

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

        if finishing_onboarding:
            await self._add_welcome_contacts(user)

        await self.session.commit()
        await self._broadcast_profile(user)
        return user

    async def _add_welcome_contacts(self, user: User) -> None:
        """A new account starts with no chats but the demo people in its contacts, so a reviewer
        can message someone straight away instead of facing an empty address book."""
        for person in await self.users.list_by_phones(self.welcome_contact_phones):
            if person.id != user.id and person.first_name is not None:
                self.contacts.add(Contact(owner_id=user.id, contact_id=person.id))

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
