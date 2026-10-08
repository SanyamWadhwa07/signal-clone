from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import ConversationSvc, CurrentUser, MessageSvc, ReceiptSvc, limit_send
from app.schemas.conversation import (
    ConversationOut,
    OpenDirectRequest,
    ReadRequest,
    ReadStateOut,
    UpdateConversationRequest,
)
from app.schemas.message import MessageOut, MessagePage, SendMessageRequest

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationOut])
async def list_conversations(user: CurrentUser, service: ConversationSvc) -> list[ConversationOut]:
    return await service.list_for(user)


@router.post("/direct", response_model=ConversationOut)
async def open_direct(
    body: OpenDirectRequest, user: CurrentUser, service: ConversationSvc
) -> ConversationOut:
    return await service.open_direct(user, body.user_id)


@router.get("/{conversation_id}", response_model=ConversationOut)
async def get_conversation(
    conversation_id: int, user: CurrentUser, service: ConversationSvc
) -> ConversationOut:
    return await service.get(user, conversation_id)


@router.patch("/{conversation_id}", response_model=ConversationOut)
async def update_conversation(
    conversation_id: int,
    body: UpdateConversationRequest,
    user: CurrentUser,
    service: ConversationSvc,
) -> ConversationOut:
    return await service.update(user, conversation_id, body)


@router.post("/{conversation_id}/read", response_model=ReadStateOut)
async def mark_read(
    conversation_id: int, body: ReadRequest, user: CurrentUser, receipts: ReceiptSvc
) -> ReadStateOut:
    return await receipts.mark_read(user.id, conversation_id, body.up_to_id)


@router.get("/{conversation_id}/messages", response_model=MessagePage)
async def list_messages(
    conversation_id: int,
    user: CurrentUser,
    messages: MessageSvc,
    before_id: int | None = Query(default=None, ge=1),
    after_id: int | None = Query(default=None, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
) -> MessagePage:
    return await messages.history(
        user.id, conversation_id, before_id=before_id, after_id=after_id, limit=limit
    )


@router.post(
    "/{conversation_id}/messages", response_model=MessageOut, dependencies=[Depends(limit_send)]
)
async def send_message(
    conversation_id: int,
    body: SendMessageRequest,
    response: Response,
    user: CurrentUser,
    messages: MessageSvc,
) -> MessageOut:
    message, created = await messages.send(user.id, conversation_id, body)
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return message
