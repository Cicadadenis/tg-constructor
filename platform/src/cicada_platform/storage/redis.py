"""Redis cache / KV (optional redis package)."""

from __future__ import annotations

import json
from typing import Any


class RedisKeyValueStore:
    def __init__(self, url: str = "redis://localhost:6379/0") -> None:
        self._url = url
        self._client: Any = None

    async def _ensure(self) -> Any:
        if self._client is None:
            try:
                import redis.asyncio as redis  # type: ignore[import-untyped]
            except ImportError as exc:
                raise ImportError("pip install 'cicada-platform[redis]'") from exc
            self._client = redis.from_url(self._url, decode_responses=True)
        return self._client

    async def get(self, key: str) -> Any | None:
        client = await self._ensure()
        raw = await client.get(key)
        return json.loads(raw) if raw else None

    async def set(self, key: str, value: Any, *, ttl_seconds: int | None = None) -> None:
        client = await self._ensure()
        payload = json.dumps(value, ensure_ascii=False)
        if ttl_seconds:
            await client.setex(key, ttl_seconds, payload)
        else:
            await client.set(key, payload)

    async def delete(self, key: str) -> None:
        client = await self._ensure()
        await client.delete(key)
