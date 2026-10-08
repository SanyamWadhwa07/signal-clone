"""WebSocket event names. Envelope on the wire: {"type": <event>, "payload": {...}}."""

# Server -> client
READY = "ready"
PONG = "pong"
MESSAGE_NEW = "message.new"
MESSAGE_DELETED = "message.deleted"
MESSAGE_EXPIRED = "message.expired"
MESSAGE_STATUS = "message.status"
REACTION_UPDATED = "reaction.updated"
TYPING = "typing"
PRESENCE = "presence"
USER_UPDATED = "user.updated"
CONVERSATION_UPDATED = "conversation.updated"
CONVERSATION_REMOVED = "conversation.removed"
CONVERSATION_READ = "conversation.read"

# Client -> server
C_AUTH = "auth"
C_PING = "ping"
C_TYPING = "typing"
