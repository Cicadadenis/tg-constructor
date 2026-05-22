"""Canonical JSON serialization for AST fixtures (sorted keys, stable floats)."""

from __future__ import annotations

import json
from typing import Any


def _normalize(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _normalize(v) for k, v in sorted(value.items(), key=lambda x: str(x[0]))}
    if isinstance(value, list):
        return [_normalize(v) for v in value]
    if isinstance(value, float) and value == int(value):
        return int(value)
    return value


def dumps_canonical(obj: Any) -> str:
    normalized = _normalize(obj)
    return json.dumps(normalized, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
