"""AST (legacy Program) → IR."""

from __future__ import annotations

from cicada_platform.compiler.source_utils import source_hash
from cicada_platform.core.schemas.ast import AstProgramSnapshot
from cicada_platform.core.schemas.ir import IrAction, IrHandler, IrProgram, IrState


def _stmt_to_action(stmt: object) -> IrAction | None:
    name = type(stmt).__name__
    mapping = {
        "Reply": "send_message",
        "Ask": "ask",
        "Remember": "set_state",
        "Buttons": "send_buttons",
        "Sleep": "delay",
        "HttpGet": "http_request",
        "HttpPost": "http_request",
        "SaveToDB": "storage",
        "LoadFromDB": "storage",
    }
    action_type = mapping.get(name)
    if not action_type:
        return None
    params = {k: v for k, v in getattr(stmt, "__dict__", {}).items() if not k.startswith("_")}
    return IrAction(type=action_type, params=params)


def lower_program(program: object, *, dsl_source: str = "") -> tuple[AstProgramSnapshot, IrProgram]:
    handlers = getattr(program, "handlers", [])
    scenarios = getattr(program, "scenarios", {})
    blocks = getattr(program, "blocks", {})
    config = getattr(program, "config", {})

    ast = AstProgramSnapshot(
        config=dict(config),
        handler_count=len(handlers),
        scenario_count=len(scenarios),
        block_count=len(blocks),
        source_hash=source_hash(dsl_source) if dsl_source else "",
    )

    ir_handlers: list[IrHandler] = []
    for h in handlers:
        kind = getattr(h, "kind", "text")
        event_map = {
            "start": "start",
            "command": "command",
            "button": "callback",
            "callback": "callback",
            "text": "message",
            "before_each": "message",
            "after_each": "message",
        }
        event = event_map.get(kind, "message")
        state_id = f"handler_{kind}_{len(ir_handlers)}"
        actions: list[IrAction] = []
        for stmt in getattr(h, "body", []):
            act = _stmt_to_action(stmt)
            if act:
                actions.append(act)
        ir_handlers.append(
            IrHandler(
                event=event,  # type: ignore[arg-type]
                trigger=str(getattr(h, "trigger", "") or ""),
                entry_state=state_id,
                states=[IrState(id=state_id, actions=actions)],
            )
        )

    ir = IrProgram(
        name=str(config.get("name", "bot")),
        config=dict(config),
        handlers=ir_handlers,
        globals=dict(getattr(program, "globals", {})),
    )
    return ast, ir
