from sqlalchemy import delete, select
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Reaction
from app.models.base import utcnow


class ReactionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def upsert(self, message_id: int, user_id: int, emoji: str) -> None:
        stmt = insert(Reaction).values(
            message_id=message_id, user_id=user_id, emoji=emoji, created_at=utcnow()
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[Reaction.message_id, Reaction.user_id],
            set_={"emoji": stmt.excluded.emoji, "created_at": stmt.excluded.created_at},
        )
        await self.session.execute(stmt)

    async def delete(self, message_id: int, user_id: int | None = None) -> None:
        stmt = delete(Reaction).where(Reaction.message_id == message_id)
        if user_id is not None:
            stmt = stmt.where(Reaction.user_id == user_id)
        await self.session.execute(stmt)

    async def list_for(self, message_id: int) -> list[Reaction]:
        stmt = (
            select(Reaction).where(Reaction.message_id == message_id).order_by(Reaction.created_at)
        )
        return list(await self.session.scalars(stmt))
