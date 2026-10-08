from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import bad_request, not_found
from app.models import Contact, User
from app.realtime.publisher import PresenceTracker
from app.repositories.contacts import ContactRepository
from app.repositories.users import UserRepository
from app.schemas.contact import ContactOut, CreateContactRequest
from app.services.presenters import user_public


class ContactService:
    def __init__(
        self,
        session: AsyncSession,
        contacts: ContactRepository,
        users: UserRepository,
        presence: PresenceTracker,
    ) -> None:
        self.session = session
        self.contacts = contacts
        self.users = users
        self.presence = presence

    def _out(self, contact: Contact) -> ContactOut:
        return ContactOut(
            id=contact.id,
            nickname=contact.nickname,
            user=user_public(contact.contact, online=self.presence.is_online(contact.contact_id)),
            created_at=contact.created_at,
        )

    async def list_for(self, me: User) -> list[ContactOut]:
        return [self._out(c) for c in await self.contacts.list_for_owner(me.id)]

    async def add(self, me: User, request: CreateContactRequest) -> tuple[ContactOut, bool]:
        """Returns (contact, created). Adding an existing contact is idempotent and updates the nickname."""
        target = (
            await self.users.get_by_phone(request.phone)
            if request.phone
            else await self.users.get_by_username((request.username or "").lower())
        )
        if target is None or target.first_name is None:
            raise not_found("This person isn't using Signal.")
        if target.id == me.id:
            raise bad_request("cannot_add_self", "You can't add yourself as a contact.")

        existing = await self.contacts.get_for_pair(me.id, target.id)
        if existing is not None:
            if request.nickname is not None:
                existing.nickname = request.nickname
                await self.session.commit()
            return self._out(existing), False

        contact = Contact(owner_id=me.id, contact_id=target.id, nickname=request.nickname)
        self.contacts.add(contact)
        await self.session.commit()
        await self.session.refresh(contact, attribute_names=["contact"])
        return self._out(contact), True

    async def _owned(self, me: User, contact_id: int) -> Contact:
        contact = await self.contacts.get(contact_id)
        if contact is None or contact.owner_id != me.id:
            raise not_found("Contact not found.")
        return contact

    async def update_nickname(self, me: User, contact_id: int, nickname: str | None) -> ContactOut:
        contact = await self._owned(me, contact_id)
        contact.nickname = nickname
        await self.session.commit()
        return self._out(contact)

    async def remove(self, me: User, contact_id: int) -> None:
        contact = await self._owned(me, contact_id)
        await self.contacts.delete(contact)
        await self.session.commit()
