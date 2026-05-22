"""FSM helper — NOT the primary execution engine (see graph_engine.py)."""

from __future__ import annotations

from cicada_platform.core.events.models import CicadaEvent
from cicada_platform.core.schemas.ir_graph import IrProgramGraph
from cicada_platform.runtime.context import RuntimeContext


class StateMachineHelper:
    """Debugger/UI helper only."""

    def __init__(self, graph: IrProgramGraph) -> None:
        self._graph = graph

    def handler_for_event(self, event: CicadaEvent) -> str | None:
        text = event.text or ""
        if text == "/start":
            for h in self._graph.handlers:
                if h.kind == "start":
                    return h.entry_node
        if text.startswith("/"):
            cmd = text.split()[0]
            for h in self._graph.handlers:
                if h.kind == "command" and h.trigger == cmd:
                    return h.entry_node
        for h in self._graph.handlers:
            if h.kind == "text" and (not h.trigger or h.trigger == text):
                return h.entry_node
        return None

    def resolve_transition(self, _state_id: str, _event: CicadaEvent, _ctx: RuntimeContext) -> str | None:
        return None
