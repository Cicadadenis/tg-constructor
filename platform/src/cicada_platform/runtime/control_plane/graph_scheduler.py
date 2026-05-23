"""Deferred execution boundary (timers, delays) — control plane only."""

from __future__ import annotations

from typing import Any

from cicada_platform.runtime.control_plane.protocol import ControlPlaneHost


class GraphScheduler:
    """
    Scheduling layer for time-based ops (Sleep, Timeout).

    Today Sleep/Timeout run synchronously via NativeOps during traversal;
    this module is the extension point for async/deferred scheduling without
    mixing timer logic into router or traversal.
    """

    def __init__(self, host: ControlPlaneHost) -> None:
        self._host = host

    def run_sleep_op(self, seconds: float, ctx: Any) -> None:
        """Synchronous sleep — semantics unchanged until async scheduler exists."""
        import time

        time.sleep(seconds)

    def should_defer_timeout(self, _stmt: Any) -> bool:
        return False
