from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Attachment


class AttachmentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add(self, attachment: Attachment) -> None:
        self.session.add(attachment)

    async def get(self, attachment_id: int) -> Attachment | None:
        return await self.session.get(Attachment, attachment_id)

    async def delete(self, attachment: Attachment) -> None:
        await self.session.delete(attachment)

    async def for_messages(self, message_ids: Sequence[int]) -> list[Attachment]:
        if not message_ids:
            return []
        stmt = select(Attachment).where(Attachment.message_id.in_(message_ids))
        return list(await self.session.scalars(stmt))

    async def orphans_before(self, cutoff: datetime) -> list[Attachment]:
        """Uploads never attached to a message (abandoned composer drafts)."""
        stmt = select(Attachment).where(
            Attachment.message_id.is_(None), Attachment.created_at < cutoff
        )
        return list(await self.session.scalars(stmt))
