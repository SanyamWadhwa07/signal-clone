from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser, GroupSvc
from app.schemas.conversation import (
    AddMembersRequest,
    ConversationOut,
    CreateGroupRequest,
    MemberOut,
    UpdateRoleRequest,
)

router = APIRouter(prefix="/groups", tags=["groups"])


@router.post("", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
async def create_group(
    body: CreateGroupRequest, user: CurrentUser, service: GroupSvc
) -> ConversationOut:
    return await service.create(user, body)


@router.get("/{group_id}/members", response_model=list[MemberOut])
async def list_members(group_id: int, user: CurrentUser, service: GroupSvc) -> list[MemberOut]:
    return await service.list_members(user, group_id)


@router.post("/{group_id}/members", response_model=list[MemberOut])
async def add_members(
    group_id: int, body: AddMembersRequest, user: CurrentUser, service: GroupSvc
) -> list[MemberOut]:
    return await service.add_members(user, group_id, body.user_ids)


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    group_id: int, user_id: int, user: CurrentUser, service: GroupSvc
) -> Response:
    await service.remove_member(user, group_id, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def set_role(
    group_id: int, user_id: int, body: UpdateRoleRequest, user: CurrentUser, service: GroupSvc
) -> Response:
    await service.set_role(user, group_id, user_id, body.role)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{group_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_group(group_id: int, user: CurrentUser, service: GroupSvc) -> Response:
    await service.leave(user, group_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
