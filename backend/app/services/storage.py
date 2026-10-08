import asyncio
import uuid
from pathlib import Path


class FileStorage:
    """Local-disk blob store for uploads. Keys are unguessable uuids; callers never build paths."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        # Keys are generated here, but guard against traversal if one is ever persisted from elsewhere.
        path = (self.root / key).resolve()
        if path.parent != self.root.resolve():
            raise ValueError("Invalid storage key")
        return path

    async def save(self, data: bytes, extension: str) -> str:
        key = f"{uuid.uuid4().hex}{extension}"
        await asyncio.to_thread(self._path(key).write_bytes, data)
        return key

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self._path(key).unlink, True)
