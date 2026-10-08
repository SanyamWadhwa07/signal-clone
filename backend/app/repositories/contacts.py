from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Contact, User


class ContactRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_for_owner(self, owner_id: int) -> list[Contact]:
        display = func.coalesce(Contact.nickname, User.first_name, User.phone)
        stmt = (
            select(Contact)
            .join(User, User.id == Contact.contact_id)
            .where(Contact.owner_id == owner_id)
            .order_by(func.lower(display))
        )
        return list(await self.session.scalars(stmt))

    async def get(self, contact_id: int) -> Contact | None:
        return await self.session.get(Contact, contact_id)

    async def get_for_pair(self, owner_id: int, user_id: int) -> Contact | None:
        return await self.session.scalar(
            select(Contact).where(Contact.owner_id == owner_id, Contact.contact_id == user_id)
        )

    def add(self, contact: Contact) -> None:
        self.session.add(contact)

    async def delete(self, contact: Contact) -> None:
        await self.session.delete(contact)
