"""Composition root: the only place that knows how repositories, services and infrastructure fit.

Every method builds a service bound to one DB session, so request handlers stay thin and tests can
swap infrastructure (realtime, storage) by constructing the container differently.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.rate_limit import Limiters
from app.db.session import SessionFactory
from app.realtime.manager import ConnectionManager
from app.realtime.publisher import Realtime
from app.repositories.attachments import AttachmentRepository
from app.repositories.contacts import ContactRepository
from app.repositories.conversations import ConversationRepository
from app.repositories.messages import MessageRepository
from app.repositories.reactions import ReactionRepository
from app.repositories.receipts import ReceiptRepository
from app.repositories.users import AuthSessionRepository, UserRepository
from app.services.attachments import AttachmentService
from app.services.auth import AuthService
from app.services.contacts import ContactService
from app.services.conversations import ConversationService
from app.services.groups import GroupService
from app.services.messages import MessageService
from app.services.presence import PresenceService
from app.services.reactions import ReactionService
from app.services.receipts import ReceiptService
from app.services.search import SearchService
from app.services.storage import FileStorage
from app.services.typing import TypingService
from app.services.users import UserService


class ServiceContainer:
    def __init__(
        self,
        settings: Settings,
        session_factory: SessionFactory,
        manager: ConnectionManager,
        storage: FileStorage,
        realtime: Realtime | None = None,
    ) -> None:
        self.settings = settings
        self.session_factory = session_factory
        self.manager = manager
        self.storage = storage
        # Production: the websocket manager. Tests may inject a recording fake instead.
        self.realtime: Realtime = realtime or manager
        self.presence = PresenceService(session_factory, self.realtime, self.realtime, settings)
        self.limiters = Limiters.from_settings(settings)

    def auth(self, session: AsyncSession) -> AuthService:
        return AuthService(
            session, UserRepository(session), AuthSessionRepository(session), self.settings
        )

    def users(self, session: AsyncSession) -> UserService:
        return UserService(
            session,
            UserRepository(session),
            ContactRepository(session),
            self.realtime,
            self.realtime,
            self.settings.welcome_contact_phones if self.settings.welcome_contacts else (),
        )

    def contacts(self, session: AsyncSession) -> ContactService:
        return ContactService(
            session, ContactRepository(session), UserRepository(session), self.realtime
        )

    def messages(self, session: AsyncSession) -> MessageService:
        return MessageService(
            session,
            MessageRepository(session),
            ConversationRepository(session),
            ReceiptRepository(session),
            ReactionRepository(session),
            AttachmentRepository(session),
            self.realtime,
            self.realtime,
            self.storage,
        )

    def receipts(self, session: AsyncSession) -> ReceiptService:
        return ReceiptService(
            session,
            MessageRepository(session),
            ConversationRepository(session),
            ReceiptRepository(session),
            UserRepository(session),
            self.realtime,
        )

    def reactions(self, session: AsyncSession) -> ReactionService:
        return ReactionService(
            session,
            MessageRepository(session),
            ConversationRepository(session),
            ReactionRepository(session),
            self.realtime,
        )

    def conversations(self, session: AsyncSession) -> ConversationService:
        return ConversationService(
            session,
            ConversationRepository(session),
            MessageRepository(session),
            ReceiptRepository(session),
            UserRepository(session),
            self.messages(session),
            self.realtime,
            self.realtime,
        )

    def groups(self, session: AsyncSession) -> GroupService:
        return GroupService(
            session,
            ConversationRepository(session),
            MessageRepository(session),
            ReceiptRepository(session),
            UserRepository(session),
            self.conversations(session),
            self.messages(session),
            self.receipts(session),
            self.realtime,
            self.realtime,
        )

    def attachments(self, session: AsyncSession) -> AttachmentService:
        return AttachmentService(
            session, AttachmentRepository(session), self.storage, self.settings
        )

    def search(self, session: AsyncSession) -> SearchService:
        return SearchService(
            self.conversations(session),
            self.contacts(session),
            MessageRepository(session),
            ReceiptRepository(session),
        )

    def typing(self, session: AsyncSession) -> TypingService:
        return TypingService(
            UserRepository(session), ConversationRepository(session), self.realtime
        )
