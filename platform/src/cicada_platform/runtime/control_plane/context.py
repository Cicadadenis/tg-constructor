"""Shared control-plane helpers."""

from __future__ import annotations


def auto_cast(value: str):
    try:
        return int(value)
    except ValueError:
        pass
    try:
        return float(value)
    except ValueError:
        pass
    return value
