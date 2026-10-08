import asyncio
import json
import logging
from collections.abc import Iterable
from typing import Any

from fastapi.encoders import jsonable_encoder
from starlette.websockets import WebSocket

logger = logging.getLogger(__name__)


def encode_event(event: str, payload: Any) -> str:
    return json.dumps({"type": event, "payload": jsonable_encoder(payload)})


class ConnectionManager:
    """In-memory registry of live sockets per user. Implements EventPublisher + PresenceTracker.

    A user may hold several sockets (multiple tabs/devices). Each socket gets its own lock so
    concurrent publishers never interleave frames on the same connection.
    """

    def __init__(self) -> None:
        self._sockets: dict[int, dict[WebSocket, asyncio.Lock]] = {}

    def connect(self, user_id: int, websocket: WebSocket) -> bool:
        """Register a socket. Returns True if this is the user's first live socket."""
        sockets = self._sockets.setdefault(user_id, {})
        first = not sockets
        sockets[websocket] = asyncio.Lock()
        return first

    def disconnect(self, user_id: int, websocket: WebSocket) -> bool:
        """Unregister a socket. Returns True if the user has no live sockets left."""
        sockets = self._sockets.get(user_id)
        if not sockets or websocket not in sockets:
            return False
        del sockets[websocket]
        if sockets:
            return False
        del self._sockets[user_id]
        return True

    def is_online(self, user_id: int) -> bool:
        return bool(self._sockets.get(user_id))

    async def send(self, websocket: WebSocket, lock: asyncio.Lock | None, text: str) -> None:
        try:
            if lock is None:
                await websocket.send_text(text)
                return
            async with lock:
                await websocket.send_text(text)
        except Exception:  # noqa: BLE001 - a dead socket is cleaned up by its own receive loop
            logger.debug("Dropping event for a closed socket")

    async def send_to_socket(
        self, user_id: int, websocket: WebSocket, event: str, payload: Any
    ) -> None:
        lock = self._sockets.get(user_id, {}).get(websocket)
        await self.send(websocket, lock, encode_event(event, payload))

    async def publish(self, user_ids: Iterable[int], event: str, payload: Any) -> None:
        text = encode_event(event, payload)
        targets = [
            (websocket, lock)
            for user_id in set(user_ids)
            for websocket, lock in list(self._sockets.get(user_id, {}).items())
        ]
        if targets:
            await asyncio.gather(*(self.send(ws, lock, text) for ws, lock in targets))
