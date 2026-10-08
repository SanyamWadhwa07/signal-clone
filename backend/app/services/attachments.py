import re
from datetime import datetime
from pathlib import PurePosixPath

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import AppError, bad_request
from app.models import Attachment, User
from app.repositories.attachments import AttachmentRepository
from app.schemas.message import AttachmentOut
from app.services.presenters import attachment_out
from app.services.storage import FileStorage

# extension -> accepted MIME types
ALLOWED_TYPES: dict[str, set[str]] = {
    ".png": {"image/png"},
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
    ".gif": {"image/gif"},
    ".webp": {"image/webp"},
    ".pdf": {"application/pdf"},
    ".txt": {"text/plain"},
    ".zip": {"application/zip", "application/x-zip-compressed"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    ".xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
}

# Leading bytes that prove the content matches the claimed type (images and PDF).
_MAGIC: dict[str, tuple[bytes, ...]] = {
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".gif": (b"GIF87a", b"GIF89a"),
    ".webp": (b"RIFF",),
    ".pdf": (b"%PDF-",),
}

_UNSAFE = re.compile(r"[\x00-\x1f\\/:*?\"<>|]")


def sanitize_filename(name: str) -> str:
    base = PurePosixPath(name.replace("\\", "/")).name
    cleaned = _UNSAFE.sub("_", base).strip(" .")[:120]
    return cleaned or "file"


class AttachmentService:
    def __init__(
        self,
        session: AsyncSession,
        attachments: AttachmentRepository,
        storage: FileStorage,
        settings: Settings,
    ) -> None:
        self.session = session
        self.attachments = attachments
        self.storage = storage
        self.settings = settings

    async def upload(
        self, me: User, filename: str, content_type: str | None, data: bytes
    ) -> AttachmentOut:
        if len(data) > self.settings.max_upload_bytes:
            raise AppError(
                413, "file_too_large", f"Files can be up to {self.settings.max_upload_mb} MB."
            )
        if not data:
            raise bad_request("empty_file", "That file is empty.")

        name = sanitize_filename(filename)
        extension = PurePosixPath(name).suffix.lower()
        mime = (content_type or "").split(";")[0].strip().lower()
        if extension not in ALLOWED_TYPES or mime not in ALLOWED_TYPES[extension]:
            raise bad_request("unsupported_type", "This type of file can't be sent.")
        signatures = _MAGIC.get(extension)
        if signatures and not data.startswith(signatures):
            raise bad_request(
                "unsupported_type", "This file doesn't look like a valid " + extension
            )

        key = await self.storage.save(data, extension)
        attachment = Attachment(
            uploader_id=me.id,
            original_name=name,
            mime=mime,
            size=len(data),
            storage_key=key,
        )
        self.attachments.add(attachment)
        await self.session.commit()
        return attachment_out(attachment)

    async def purge_orphans(self, cutoff: datetime) -> int:
        """Remove uploads that were never attached to a message."""
        orphans = await self.attachments.orphans_before(cutoff)
        for attachment in orphans:
            await self.storage.delete(attachment.storage_key)
            await self.attachments.delete(attachment)
        if orphans:
            await self.session.commit()
        return len(orphans)
