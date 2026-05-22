"""In-memory storage (default dev)."""

from __future__ import annotations

import asyncio
from typing import Any


class InMemoryKeyValueStore:
    def __init__(self) -> None:
        self._data: dict[str, Any] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Any | None:
        async with self._lock:
            return self._data.get(key)

    async def set(self, key: str, value: Any, *, ttl_seconds: int | None = None) -> None:
        async with self._lock:
            self._data[key] = value

    async def delete(self, key: str) -> None:
        async with self._lock:
            self._data.pop(key, None)


class InMemorySessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def load_session(self, session_id: str) -> dict[str, Any]:
        async with self._lock:
            return dict(self._sessions.get(session_id, {}))

    async def save_session(self, session_id: str, data: dict[str, Any]) -> None:
        async with self._lock:
            self._sessions[session_id] = dict(data)


class InMemoryCache:
    def __init__(self) -> None:
        self._kv = InMemoryKeyValueStore()

    async def get(self, key: str) -> Any | None:
        return await self._kv.get(key)

    async def set(self, key: str, value: Any, *, ttl_seconds: int | None = 300) -> None:
        await self._kv.set(key, value, ttl_seconds=ttl_seconds)
