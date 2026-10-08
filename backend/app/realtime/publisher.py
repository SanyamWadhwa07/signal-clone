from collections.abc import Iterable
from typing import Any, Protocol


class EventPublisher(Protocol):
    """Pushes an event to every live connection of the given users.

    Services depend on this abstraction only, so the in-memory WebSocket implementation can be
    swapped (e.g. Redis pub/sub for multiple workers) without touching business logic.
    """

    async def publish(self, user_ids: Iterable[int], event: str, payload: Any) -> None: ...


class PresenceTracker(Protocol):
    def is_online(self, user_id: int) -> bool: ...


class Realtime(EventPublisher, PresenceTracker, Protocol):
    """What the app needs from a realtime backend: push events and know who is online."""
