"""Serialize / deserialize legacy parser AST nodes for IR payloads."""

from __future__ import annotations

from dataclasses import fields, is_dataclass
from typing import Any


def _serialize_value(value: Any) -> Any:
    if is_dataclass(value):
        return serialize_stmt(value)
    if isinstance(value, list):
        return [_serialize_value(v) for v in value]
    if isinstance(value, dict):
        return {k: _serialize_value(v) for k, v in value.items()}
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return repr(value)


def serialize_stmt(stmt: object) -> dict[str, Any]:
    if not is_dataclass(stmt):
        return {"op": type(stmt).__name__, "payload": {"value": repr(stmt)}}
    data = {f.name: _serialize_value(getattr(stmt, f.name)) for f in fields(stmt)}
    return {"op": type(stmt).__name__, "payload": data}


def deserialize_stmt(data: dict[str, Any]) -> object:
    import cicada.parser as p  # type: ignore[import-untyped]

    op = data["op"]
    payload = data.get("payload", {})
    cls = getattr(p, op, None)
    if cls is None:
        raise ValueError(f"Unknown AST op {op!r}")
    kwargs = {k: _deserialize_value(v) for k, v in payload.items()}
    return cls(**kwargs)


def _deserialize_value(value: Any) -> Any:
    if isinstance(value, dict) and "op" in value and "payload" in value:
        return deserialize_stmt(value)
    if isinstance(value, list):
        return [_deserialize_value(v) for v in value]
    if isinstance(value, dict):
        return {k: _deserialize_value(v) for k, v in value.items()}
    return value
