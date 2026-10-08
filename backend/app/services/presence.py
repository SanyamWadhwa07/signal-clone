import asyncio
import logging

from app.core.config import Settings
from app.db.session import SessionFactory
from app.models.base import utcnow
from app.realtime import events
from app.realtime.publisher import EventPublisher, PresenceTracker
from app.repositories.users import UserRepository

logger = logging.getLogger(__name__)


class PresenceService:
    """Online/last-seen tracking. App-scoped (not per-request): it outlives any single request.

    A user is online while they hold at least one socket. When the last socket closes we wait a
    short grace period before declaring them offline, so a page refresh doesn't flicker.
    """

    def __init__(
        self,
        session_factory: SessionFactory,
        publisher: EventPublisher,
        tracker: PresenceTracker,
        settings: Settings,
    ) -> None:
        self.session_factory = session_factory
        self.publisher = publisher
        self.tracker = tracker
        self.settings = settings
        self._pending_offline: dict[int, asyncio.Task[None]] = {}

    async def user_connected(self, user_id: int, *, first_socket: bool) -> None:
        pending = self._pending_offline.pop(user_id, None)
        if pending is not None:
            pending.cancel()  # reconnected within the grace period: nobody saw them leave
            return
        if first_socket:
            await self._broadcast(user_id, online=True)

    def user_disconnected(self, user_id: int, *, last_socket: bool) -> None:
        if not last_socket:
            return
        previous = self._pending_offline.pop(user_id, None)
        if previous is not None:
            previous.cancel()
        self._pending_offline[user_id] = asyncio.create_task(self._go_offline(user_id))

    async def _go_offline(self, user_id: int) -> None:
        await asyncio.sleep(self.settings.presence_grace_seconds)
        self._pending_offline.pop(user_id, None)
        if self.tracker.is_online(user_id):
            return
        # Background work can be handed a pooled connection that died while a cancelled request
        # was releasing it; the pool discards it on first use, so one retry gets a healthy one.
        for attempt in (1, 2):
            try:
                async with self.session_factory() as session:
                    await UserRepository(session).set_last_seen(user_id, utcnow())
                    await session.commit()
                await self._broadcast(user_id, online=False)
                return
            except asyncio.CancelledError:
                raise
            except Exception:
                if attempt == 2:
                    logger.exception("Failed to mark user %s offline", user_id)

    async def _broadcast(self, user_id: int, *, online: bool) -> None:
        async with self.session_factory() as session:
            users = UserRepository(session)
            user = await users.get(user_id)
            if user is None:
                return
            audience = await users.audience_ids(user_id)
            payload = {
                "user_id": user_id,
                "online": online,
                "last_seen_at": None if online else user.last_seen_at,
            }
        await self.publisher.publish(audience, events.PRESENCE, payload)

    async def shutdown(self) -> None:
        for task in self._pending_offline.values():
            task.cancel()
        self._pending_offline.clear()
