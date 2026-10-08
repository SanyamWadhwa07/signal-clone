from fastapi import APIRouter, Response, status

from app.api.deps import ContactSvc, CurrentUser
from app.schemas.contact import ContactOut, CreateContactRequest, UpdateContactRequest

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=list[ContactOut])
async def list_contacts(user: CurrentUser, service: ContactSvc) -> list[ContactOut]:
    return await service.list_for(user)


@router.post("", response_model=ContactOut)
async def add_contact(
    body: CreateContactRequest, response: Response, user: CurrentUser, service: ContactSvc
) -> ContactOut:
    contact, created = await service.add(user, body)
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return contact


@router.patch("/{contact_id}", response_model=ContactOut)
async def update_contact(
    contact_id: int, body: UpdateContactRequest, user: CurrentUser, service: ContactSvc
) -> ContactOut:
    return await service.update_nickname(user, contact_id, body.nickname)


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(contact_id: int, user: CurrentUser, service: ContactSvc) -> Response:
    await service.remove(user, contact_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
