from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser, MessageSvc, ReactionSvc
from app.schemas.message import ReactRequest

router = APIRouter(prefix="/messages", tags=["messages"])


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(message_id: int, user: CurrentUser, service: MessageSvc) -> Response:
    await service.delete(user.id, message_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{message_id}/reaction", status_code=status.HTTP_204_NO_CONTENT)
async def set_reaction(
    message_id: int, body: ReactRequest, user: CurrentUser, service: ReactionSvc
) -> Response:
    await service.react(user.id, message_id, body.emoji)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{message_id}/reaction", status_code=status.HTTP_204_NO_CONTENT)
async def clear_reaction(message_id: int, user: CurrentUser, service: ReactionSvc) -> Response:
    await service.react(user.id, message_id, None)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
