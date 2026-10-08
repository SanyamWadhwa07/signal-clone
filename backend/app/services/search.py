from app.models import User
from app.models.base import utcnow
from app.repositories.messages import MessageRepository
from app.repositories.receipts import ReceiptRepository
from app.schemas.contact import ContactOut
from app.schemas.conversation import ConversationOut
from app.schemas.message import MessageSearchHit
from app.schemas.search import SearchOut
from app.services.contacts import ContactService
from app.services.conversations import ConversationService
from app.services.presenters import message_out

MIN_QUERY_LENGTH = 2
MESSAGE_HIT_LIMIT = 20


def _matches(term: str, *fields: str | None) -> bool:
    return any(term in field.lower() for field in fields if field)


class SearchService:
    """One search box for chats, contacts and message text (all scoped to the caller)."""

    def __init__(
        self,
        conversation_service: ConversationService,
        contact_service: ContactService,
        messages: MessageRepository,
        receipts: ReceiptRepository,
    ) -> None:
        self.conversation_service = conversation_service
        self.contact_service = contact_service
        self.messages = messages
        self.receipts = receipts

    async def search(self, me: User, query: str) -> SearchOut:
        term = query.strip().lower()
        if len(term) < MIN_QUERY_LENGTH:
            return SearchOut(conversations=[], contacts=[], messages=[])

        conversations = [
            c
            for c in await self.conversation_service.list_for(me)
            if self._conversation_matches(term, c)
        ]
        contacts = [
            c for c in await self.contact_service.list_for(me) if self._contact_matches(term, c)
        ]
        found = await self.messages.search(me.id, term, utcnow(), MESSAGE_HIT_LIMIT)
        statuses = await self.receipts.statuses([m.id for m in found if m.sender_id == me.id])
        hits = [
            MessageSearchHit(
                message=message_out(m, me.id, statuses.get(m.id)), conversation_id=m.conversation_id
            )
            for m in found
        ]
        return SearchOut(conversations=conversations, contacts=contacts, messages=hits)

    @staticmethod
    def _conversation_matches(term: str, conversation: ConversationOut) -> bool:
        peer = conversation.peer
        return _matches(
            term,
            conversation.name,
            peer.display_name if peer else None,
            peer.username if peer else None,
            peer.phone if peer else None,
        )

    @staticmethod
    def _contact_matches(term: str, contact: ContactOut) -> bool:
        user = contact.user
        return _matches(term, contact.nickname, user.display_name, user.username, user.phone)
