"""File storage adapter."""

from __future__ import annotations

from pathlib import Path


class LocalFileStorage:
    def __init__(self, root: str | Path) -> None:
        self._root = Path(root)
        self._root.mkdir(parents=True, exist_ok=True)

    async def read_bytes(self, path: str) -> bytes:
        return (self._root / path).read_bytes()

    async def write_bytes(self, path: str, data: bytes) -> str:
        dest = self._root / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return str(dest)
