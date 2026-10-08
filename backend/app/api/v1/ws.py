import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.errors import AppError
from app.models import User
from app.realtime import events
from app.services.container import ServiceContainer

logger = logging.getLogger(__name__)
router = APIRouter()

AUTH_TIMEOUT_SECONDS = 5
IDLE_TIMEOUT_SECONDS = 60  # clients ping every 25s; silence beyond this means a dead connection

CLOSE_UNAUTHORIZED = 4401
CLOSE_IDLE = 4408


async def _authenticate(websocket: WebSocket, container: ServiceContainer) -> User | None:
    """First frame must be {"type": "auth", "token": ...}; keeps tokens out of URLs and logs."""
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), AUTH_TIMEOUT_SECONDS)
        frame = json.loads(raw)
        if frame.get("type") != events.C_AUTH:
            return None
        async with container.session_factory() as session:
            return await container.auth(session).authenticate(str(frame.get("token", "")))
    except (TimeoutError, ValueError, AppError, AttributeError):
        return None


async def _handle_frame(
    frame: dict[str, Any], user: User, websocket: WebSocket, container: ServiceContainer
) -> None:
    kind = frame.get("type")
    if kind == events.C_PING:
        await container.manager.send_to_socket(user.id, websocket, events.PONG, {})
    elif kind == events.C_TYPING:
        payload = frame.get("payload") or {}
        conversation_id, is_typing = payload.get("conversation_id"), payload.get("is_typing")
        if isinstance(conversation_id, int) and isinstance(is_typing, bool):
            async with container.session_factory() as session:
                await container.typing(session).relay(user.id, conversation_id, is_typing)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    container: ServiceContainer = websocket.app.state.container
    await websocket.accept()

    user = await _authenticate(websocket, container)
    if user is None:
        await websocket.close(code=CLOSE_UNAUTHORIZED)
        return

    manager = container.manager
    first_socket = manager.connect(user.id, websocket)
    await manager.send_to_socket(user.id, websocket, events.READY, {"user_id": user.id})
    try:
        await container.presence.user_connected(user.id, first_socket=first_socket)
        async with container.session_factory() as session:
            await container.receipts(session).mark_all_delivered(user.id)

        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), IDLE_TIMEOUT_SECONDS)
            except TimeoutError:
                await websocket.close(code=CLOSE_IDLE)
                break
            try:
                frame = json.loads(raw)
            except ValueError:
                continue
            if isinstance(frame, dict):
                await _handle_frame(frame, user, websocket, container)
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("WebSocket error for user %s", user.id)
    finally:
        last_socket = manager.disconnect(user.id, websocket)
        container.presence.user_disconnected(user.id, last_socket=last_socket)
