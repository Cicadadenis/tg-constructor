"""Graph execution entry — facade alias (use GraphControlPlane internally)."""

from __future__ import annotations

from cicada_platform.runtime.control_plane.graph_control_plane import GraphControlPlane


class GraphExecutionEngine(GraphControlPlane):
    """Backward-compatible name for GraphControlPlane."""
