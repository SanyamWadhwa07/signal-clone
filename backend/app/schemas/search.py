from app.schemas.common import Schema
from app.schemas.contact import ContactOut
from app.schemas.conversation import ConversationOut
from app.schemas.message import MessageSearchHit


class SearchOut(Schema):
    conversations: list[ConversationOut]
    contacts: list[ContactOut]
    messages: list[MessageSearchHit]
