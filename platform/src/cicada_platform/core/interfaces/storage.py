"""Storage backends contract."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class KeyValueStore(Protocol):
    async def get(self, key: str) -> Any | None: ...
    async def set(self, key: str, value: Any, *, ttl_seconds: int | None = None) -> None: ...
    async def delete(self, key: str) -> None: ...


@runtime_checkable
class SessionStore(Protocol):
    async def load_session(self, session_id: str) -> dict[str, Any]: ...
    async def save_session(self, session_id: str, data: dict[str, Any]) -> None: ...


@runtime_checkable
class FileStorage(Protocol):
    async def read_bytes(self, path: str) -> bytes: ...
    async def write_bytes(self, path: str, data: bytes) -> str: ...
