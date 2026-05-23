"""PostgreSQL repository (optional asyncpg)."""

from __future__ import annotations

from typing import Any


class PostgresKeyValueStore:
    """Placeholder — wire SQLAlchemy/asyncpg in production deployment."""

    def __init__(self, dsn: str) -> None:
        self._dsn = dsn
        self._memory: dict[str, Any] = {}

    async def get(self, key: str) -> Any | None:
        return self._memory.get(key)

    async def set(self, key: str, value: Any, *, ttl_seconds: int | None = None) -> None:
        self._memory[key] = value

    async def delete(self, key: str) -> None:
        self._memory.pop(key, None)
