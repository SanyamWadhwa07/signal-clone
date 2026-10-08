"""Idempotent demo seeding: runs only when the database has no users."""

import uuid
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.session import SessionFactory
from app.models import (
    Attachment,
    Contact,
    Conversation,
    ConversationMember,
    ConversationType,
    MemberRole,
    Message,
    MessageKind,
    MessageReceipt,
    Reaction,
    User,
)
from app.models.base import utcnow
from app.seed.data import CONTACTS, DIRECTS, GROUPS, SYSTEM, USERS, DirectSpec, GroupSpec, Line
from app.services.auth import avatar_color_for
from app.services.conversations import direct_key

ASSETS_DIR = Path(__file__).parent / "assets"  # pre-rendered by `python -m app.seed.make_assets`


async def seed_if_empty(session_factory: SessionFactory, settings: Settings) -> None:
    async with session_factory() as session:
        if await session.scalar(select(func.count(User.id))):
            return
        await _Seeder(session, settings.upload_dir, utcnow()).run()
        await session.commit()


class _Seeder:
    def __init__(self, session: AsyncSession, upload_dir: Path, now: datetime) -> None:
        self.session = session
        self.upload_dir = upload_dir
        self.now = now
        self.users: dict[str, User] = {}

    async def run(self) -> None:
        await self._users()
        await self._contacts()
        for spec in DIRECTS:
            await self._direct(spec)
        for group in GROUPS:
            await self._group(group)

    # ------------------------------------------------------------------ entities

    def _store_asset(self, relative: str) -> tuple[str, int]:
        """Copy a bundled demo image into the uploads folder; returns (storage key, size)."""
        data = (ASSETS_DIR / relative).read_bytes()
        key = f"{uuid.uuid4().hex}.png"
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        (self.upload_dir / key).write_bytes(data)
        return key, len(data)

    async def _users(self) -> None:
        for spec in USERS:
            avatar_url = (
                f"/uploads/{self._store_asset(f'avatars/{spec.avatar}.png')[0]}"
                if spec.avatar
                else None
            )
            user = User(
                phone=spec.phone,
                username=spec.username,
                first_name=spec.first,
                last_name=spec.last,
                about=spec.about,
                avatar_url=avatar_url,
                avatar_color=avatar_color_for(spec.phone),
                last_seen_at=self.now - timedelta(minutes=spec.seen_ago_min or 1),
            )
            self.session.add(user)
            self.users[spec.key] = user
        await self.session.flush()

    async def _contacts(self) -> None:
        for owner, others in CONTACTS.items():
            for other, nickname in others.items():
                self.session.add(
                    Contact(
                        owner_id=self.users[owner].id,
                        contact_id=self.users[other].id,
                        nickname=nickname,
                    )
                )
        await self.session.flush()

    async def _direct(self, spec: DirectSpec) -> None:
        a, b = self.users[spec.a], self.users[spec.b]
        conversation = Conversation(
            type=ConversationType.DIRECT,
            direct_key=direct_key(a.id, b.id),
            created_by=a.id,
            disappearing_seconds=spec.timer_seconds,
            created_at=self.now - timedelta(minutes=spec.lines[0].ago_min + 5),
        )
        self.session.add(conversation)
        await self.session.flush()
        members = {
            key: self._add_member(conversation, key, MemberRole.MEMBER)
            for key in dict.fromkeys((spec.a, spec.b))
        }
        await self._messages(
            conversation,
            members,
            spec.lines,
            spec.unread,
            timer=spec.timer_seconds,
            undelivered_last_to=spec.undelivered_last_to,
        )

    async def _group(self, spec: GroupSpec) -> None:
        icon = (
            f"/uploads/{self._store_asset(f'groups/{spec.avatar}.png')[0]}" if spec.avatar else None
        )
        conversation = Conversation(
            type=ConversationType.GROUP,
            name=spec.name,
            description=spec.description,
            avatar_url=icon,
            avatar_color=avatar_color_for(spec.name),
            created_by=self.users[spec.creator].id,
            created_at=self.now - timedelta(minutes=spec.lines[0].ago_min + 5),
        )
        self.session.add(conversation)
        await self.session.flush()
        members = {
            key: self._add_member(
                conversation, key, MemberRole.ADMIN if key in spec.admins else MemberRole.MEMBER
            )
            for key in spec.members
        }
        await self._messages(
            conversation, members, spec.lines, spec.unread, creator=spec.creator, name=spec.name
        )

    def _add_member(
        self, conversation: Conversation, key: str, role: MemberRole
    ) -> ConversationMember:
        member = ConversationMember(
            conversation_id=conversation.id,
            user_id=self.users[key].id,
            role=role,
            joined_at=conversation.created_at,
        )
        self.session.add(member)
        return member

    # ------------------------------------------------------------------ messages

    async def _messages(
        self,
        conversation: Conversation,
        members: dict[str, ConversationMember],
        lines: list[Line],
        unread: dict[str, int],
        *,
        timer: int | None = None,
        undelivered_last_to: str | None = None,
        creator: str | None = None,
        name: str | None = None,
    ) -> None:
        stored: list[tuple[Line, Message]] = []
        for line in lines:
            created = self.now - timedelta(minutes=line.ago_min)
            message = self._build(line, conversation, created, timer, creator, name)
            self.session.add(message)
            await self.session.flush()
            if line.quote is not None:
                message.reply_to_id = self._find_quoted(stored, line.quote)
            if line.image:
                self._attach_image(message, line)
            for reactor, emoji in line.reactions.items():
                self.session.add(
                    Reaction(
                        message_id=message.id,
                        user_id=self.users[reactor].id,
                        emoji=emoji,
                        created_at=created + timedelta(minutes=1),
                    )
                )
            stored.append((line, message))

        conversation.last_message_at = stored[-1][1].created_at
        last_read = self._last_read_ids(members, stored, unread)
        for key, member in members.items():
            member.last_read_message_id = last_read[key]
        self._receipts(stored, members, last_read, undelivered_last_to)
        await self.session.flush()

    @staticmethod
    def _find_quoted(stored: list[tuple[Line, Message]], quote: str) -> int:
        """The most recent earlier message whose text starts with `quote`."""
        for earlier, message in reversed(stored):
            if earlier.body and earlier.body.startswith(quote):
                return message.id
        raise ValueError(f"Seed data quotes a message that doesn't exist: {quote!r}")

    def _build(
        self,
        line: Line,
        conversation: Conversation,
        created: datetime,
        timer: int | None,
        creator: str | None,
        name: str | None,
    ) -> Message:
        if line.sender == SYSTEM:
            actor = line.actor or creator
            meta: dict[str, object] = {
                "event": line.event,
                "actor_id": self.users[actor].id if actor else None,
            }
            if line.event == "created":
                meta["name"] = name
            if line.targets:
                meta["target_ids"] = [self.users[t].id for t in line.targets]
            return Message(
                conversation_id=conversation.id,
                sender_id=None,
                kind=MessageKind.SYSTEM,
                meta=meta,
                created_at=created,
            )
        return Message(
            conversation_id=conversation.id,
            sender_id=self.users[line.sender].id,
            client_id=uuid.uuid4().hex,
            kind=MessageKind.ATTACHMENT if line.image else MessageKind.TEXT,
            body=line.body,
            created_at=created,
            expires_at=created + timedelta(seconds=timer) if timer else None,
        )

    def _attach_image(self, message: Message, line: Line) -> None:
        assert line.image is not None
        key, size = self._store_asset(f"scenes/{line.image}.png")
        assert message.sender_id is not None
        self.session.add(
            Attachment(
                uploader_id=message.sender_id,
                message_id=message.id,
                original_name=f"{line.image}.png",
                mime="image/png",
                size=size,
                storage_key=key,
                created_at=message.created_at,
            )
        )

    def _last_read_ids(
        self,
        members: dict[str, ConversationMember],
        stored: list[tuple[Line, Message]],
        unread: dict[str, int],
    ) -> dict[str, int]:
        """Marker such that exactly `unread[user]` of the messages from others come after it."""
        result: dict[str, int] = {}
        for key in members:
            theirs = [m.id for line, m in stored if line.sender not in (SYSTEM, key)]
            count = unread.get(key, 0)
            if count == 0:
                result[key] = stored[-1][1].id
            elif count >= len(theirs):
                result[key] = 0
            else:
                result[key] = theirs[len(theirs) - count - 1]
        return result

    def _receipts(
        self,
        stored: list[tuple[Line, Message]],
        members: dict[str, ConversationMember],
        last_read: dict[str, int],
        undelivered_last_to: str | None,
    ) -> None:
        last_message_id = stored[-1][1].id
        for line, message in stored:
            if line.sender == SYSTEM:
                continue
            for key in members:
                if key == line.sender:
                    continue
                if key == undelivered_last_to and message.id == last_message_id:
                    delivered = read = None
                else:
                    delivered = message.created_at + timedelta(minutes=1)
                    read = (
                        message.created_at + timedelta(minutes=2)
                        if message.id <= last_read[key]
                        else None
                    )
                self.session.add(
                    MessageReceipt(
                        message_id=message.id,
                        user_id=self.users[key].id,
                        delivered_at=delivered,
                        read_at=read,
                    )
                )
