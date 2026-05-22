"""Visual builder graph → IR (future full codegen)."""

from __future__ import annotations

from pydantic import BaseModel, Field

from cicada_platform.core.schemas.ir import IrAction, IrHandler, IrProgram, IrState


class GraphNode(BaseModel):
    id: str
    type: str
    props: dict = Field(default_factory=dict)


class RuntimeGraph(BaseModel):
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[dict] = Field(default_factory=list)

    def to_ir_stub(self) -> IrProgram:
        """Minimal IR from graph roots (full builder sync in migration phase 2)."""
        handlers: list[IrHandler] = []
        for i, node in enumerate(self.nodes):
            if node.type not in ("start", "command", "callback"):
                continue
            state_id = f"node_{node.id}"
            actions = [
                IrAction(type="send_message", params={"text": node.props.get("text", "")})
            ]
            handlers.append(
                IrHandler(
                    event="start" if node.type == "start" else "message",
                    entry_state=state_id,
                    states=[IrState(id=state_id, actions=actions)],
                )
            )
        return IrProgram(handlers=handlers)
