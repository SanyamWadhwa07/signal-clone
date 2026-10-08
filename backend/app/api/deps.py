from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import HTTPConnection

from app.core.errors import AppError
from app.db.session import get_db
from app.models import User
from app.services.attachments import AttachmentService
from app.services.auth import AuthService
from app.services.contacts import ContactService
from app.services.container import ServiceContainer
from app.services.conversations import ConversationService
from app.services.groups import GroupService
from app.services.messages import MessageService
from app.services.reactions import ReactionService
from app.services.receipts import ReceiptService
from app.services.search import SearchService
from app.services.users import UserService

Db = Annotated[AsyncSession, Depends(get_db)]


def get_container(conn: HTTPConnection) -> ServiceContainer:
    container: ServiceContainer = conn.app.state.container
    return container


Container = Annotated[ServiceContainer, Depends(get_container)]


def get_auth_service(session: Db, container: Container) -> AuthService:
    return container.auth(session)


def get_user_service(session: Db, container: Container) -> UserService:
    return container.users(session)


def get_contact_service(session: Db, container: Container) -> ContactService:
    return container.contacts(session)


def get_message_service(session: Db, container: Container) -> MessageService:
    return container.messages(session)


def get_receipt_service(session: Db, container: Container) -> ReceiptService:
    return container.receipts(session)


def get_reaction_service(session: Db, container: Container) -> ReactionService:
    return container.reactions(session)


def get_conversation_service(session: Db, container: Container) -> ConversationService:
    return container.conversations(session)


def get_group_service(session: Db, container: Container) -> GroupService:
    return container.groups(session)


def get_attachment_service(session: Db, container: Container) -> AttachmentService:
    return container.attachments(session)


def get_search_service(session: Db, container: Container) -> SearchService:
    return container.search(session)


def bearer_token(request: Request) -> str:
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise AppError(401, "unauthorized", "Please log in to continue.")
    return token


Token = Annotated[str, Depends(bearer_token)]
AuthSvc = Annotated[AuthService, Depends(get_auth_service)]


async def current_user(token: Token, auth: AuthSvc) -> User:
    return await auth.authenticate(token)


CurrentUser = Annotated[User, Depends(current_user)]
UserSvc = Annotated[UserService, Depends(get_user_service)]
ContactSvc = Annotated[ContactService, Depends(get_contact_service)]
MessageSvc = Annotated[MessageService, Depends(get_message_service)]
ReceiptSvc = Annotated[ReceiptService, Depends(get_receipt_service)]
ReactionSvc = Annotated[ReactionService, Depends(get_reaction_service)]
ConversationSvc = Annotated[ConversationService, Depends(get_conversation_service)]
GroupSvc = Annotated[GroupService, Depends(get_group_service)]
AttachmentSvc = Annotated[AttachmentService, Depends(get_attachment_service)]
SearchSvc = Annotated[SearchService, Depends(get_search_service)]


def client_ip(request: Request) -> str:
    """Client address, honouring the first X-Forwarded-For hop (Render/Vercel sit behind a proxy)."""
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return forwarded or (request.client.host if request.client else "unknown")


def limit_auth(request: Request, container: Container) -> None:
    container.limiters.auth.check(client_ip(request))


def limit_send(user: CurrentUser, container: Container) -> None:
    container.limiters.send.check(f"user:{user.id}")


def limit_upload(user: CurrentUser, container: Container) -> None:
    container.limiters.upload.check(f"user:{user.id}")
