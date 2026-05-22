"""Trace presentation levels — observability only."""

from __future__ import annotations

from enum import IntEnum


class TraceLevel(IntEnum):
    """LEVEL_0: raw events; LEVEL_1: condensed; LEVEL_2: human summary."""

    LEVEL_0 = 0
    LEVEL_1 = 1
    LEVEL_2 = 2
