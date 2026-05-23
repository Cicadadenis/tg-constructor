"""Legacy Program → IrProgramGraph (nodes + edges)."""

from __future__ import annotations

from dataclasses import fields, is_dataclass
from typing import Any
from uuid import uuid4

from cicada_platform.compiler.ast_serialize import serialize_stmt
from cicada_platform.compiler.source_utils import source_hash
from cicada_platform.core.schemas.ast import AstProgramSnapshot
from cicada_platform.core.schemas.ir_graph import (
    EdgeKind,
    IrBlockEntry,
    IrGraphEdge,
    IrGraphNode,
    IrHandlerEntry,
    IrProgramGraph,
    IrScenarioEntry,
)


def _nid(prefix: str = "n") -> str:
    return f"{prefix}_{uuid4().hex[:10]}"


class GraphBuilder:
    def __init__(self) -> None:
        self.nodes: dict[str, IrGraphNode] = {}
        self.edges: list[IrGraphEdge] = []
        self._edge_seq = 0

    def add_noop(self, label: str = "join") -> str:
        nid = _nid(label)
        self.nodes[nid] = IrGraphNode(id=nid, op="Noop", payload={}, meta={"label": label})
        return nid

    def add_stmt_node(self, stmt: object, *, meta: dict | None = None) -> str:
        ser = serialize_stmt(stmt)
        nid = _nid(ser["op"].lower())
        node_meta = dict(meta or {})
        if ser["op"] == "Ask":
            node_meta["suspend"] = True
        if ser["op"] in ("BreakLoop", "ContinueLoop"):
            node_meta["loop_signal"] = ser["op"]
        self.nodes[nid] = IrGraphNode(id=nid, op=ser["op"], payload=ser, meta=node_meta)
        return nid

    def connect(self, src: str | None, dst: str, kind: EdgeKind = EdgeKind.NEXT) -> None:
        if not src:
            return
        self._edge_seq += 1
        self.edges.append(
            IrGraphEdge(id=f"e{self._edge_seq}", source=src, target=dst, kind=kind)
        )

    def lower_body(self, stmts: list) -> tuple[str, str]:
        if not stmts:
            j = self.add_noop("empty")
            return j, j

        entry: str | None = None
        prev: str | None = None

        for stmt in stmts:
            op = type(stmt).__name__

            if op == "If":
                if_id = self.add_stmt_node(stmt)
                if entry is None:
                    entry = if_id
                self.connect(prev, if_id)

                then_entry, then_exit = self.lower_body(getattr(stmt, "then_body", []))
                join = self.add_noop("if_join")
                self.connect(if_id, then_entry, EdgeKind.TRUE)
                self.connect(then_exit, join, EdgeKind.NEXT)

                else_body = getattr(stmt, "else_body", None) or []
                if else_body:
                    else_entry, else_exit = self.lower_body(else_body)
                    self.connect(if_id, else_entry, EdgeKind.FALSE)
                    self.connect(else_exit, join, EdgeKind.NEXT)
                else:
                    self.connect(if_id, join, EdgeKind.FALSE)

                prev = join
                continue

            if op in ("ForEach", "WhileLoop"):
                loop_id = self.add_stmt_node(stmt)
                if entry is None:
                    entry = loop_id
                self.connect(prev, loop_id)
                body = getattr(stmt, "body", [])
                body_entry, body_exit = self.lower_body(body)
                exit_node = self.add_noop("loop_exit")
                self.connect(loop_id, body_entry, EdgeKind.LOOP_BODY)
                self.connect(body_exit, loop_id, EdgeKind.LOOP_BACK)
                self.connect(loop_id, exit_node, EdgeKind.LOOP_EXIT)
                prev = exit_node
                continue

            if op == "StartScenario":
                sc_id = self.add_stmt_node(stmt)
                if entry is None:
                    entry = sc_id
                self.connect(prev, sc_id)
                name = getattr(stmt, "name", "")
                self.connect(sc_id, f"scenario:{name}", EdgeKind.SCENARIO)
                prev = sc_id
                continue

            if op in ("UseBlock", "CallBlock"):
                blk_id = self.add_stmt_node(stmt)
                if entry is None:
                    entry = blk_id
                self.connect(prev, blk_id)
                name = getattr(stmt, "name", getattr(stmt, "block_name", ""))
                self.connect(blk_id, f"block:{name}", EdgeKind.BLOCK)
                prev = blk_id
                continue

            nid = self.add_stmt_node(stmt)
            if entry is None:
                entry = nid
            self.connect(prev, nid)
            if op == "Ask":
                resume = self.add_noop("after_ask")
                self.connect(nid, resume, EdgeKind.SUSPEND_RESUME)
                prev = resume
            else:
                prev = nid

        assert entry is not None and prev is not None
        return entry, prev


def _lower_scenario_steps(builder: GraphBuilder, steps: list) -> tuple[str, list[str]]:
    if not steps:
        j = builder.add_noop("scenario_empty")
        return j, [j]

    step_ids: list[str] = []
    entry: str | None = None
    prev: str | None = None

    for step in steps:
        op = type(step).__name__
        if op == "Step":
            body = getattr(step, "body", [])
            s_entry, s_exit = builder.lower_body(body)
            step_marker = builder.add_stmt_node(step, meta={"step_name": getattr(step, "name", None)})
            if entry is None:
                entry = step_marker
            builder.connect(prev, step_marker)
            builder.connect(step_marker, s_entry)
            step_ids.append(step_marker)
            prev = s_exit
        else:
            s_entry, s_exit = builder.lower_body([step])
            if entry is None:
                entry = s_entry
            builder.connect(prev, s_entry)
            step_ids.append(s_entry)
            prev = s_exit

    assert entry is not None
    return entry, step_ids


def lower_program_to_graph(program: object, *, dsl_source: str = "") -> tuple[AstProgramSnapshot, IrProgramGraph]:
    builder = GraphBuilder()
    config = dict(getattr(program, "config", {}))
    handlers_raw = getattr(program, "handlers", [])
    scenarios_raw = getattr(program, "scenarios", {})
    blocks_raw = getattr(program, "blocks", {})

    ast = AstProgramSnapshot(
        config=config,
        handler_count=len(handlers_raw),
        scenario_count=len(scenarios_raw),
        block_count=len(blocks_raw),
        source_hash=source_hash(dsl_source) if dsl_source else "",
    )

    handler_priority = {
        "before_each": 10,
        "start": 20,
        "command": 30,
        "callback": 40,
        "callback_prefix": 45,
        "text": 50,
        "photo_received": 60,
        "document_received": 60,
        "voice_received": 60,
        "sticker_received": 60,
        "location_received": 60,
        "contact_received": 60,
        "any": 900,
        "else": 900,
        "after_each": 1000,
    }

    ir_handlers: list[IrHandlerEntry] = []
    for h in handlers_raw:
        kind = getattr(h, "kind", "text")
        body = getattr(h, "body", [])
        entry, _exit = builder.lower_body(body)
        trigger = getattr(h, "trigger", None)
        if trigger is not None and not isinstance(trigger, str):
            trigger = str(trigger)
        ir_handlers.append(
            IrHandlerEntry(
                kind=kind,
                trigger=trigger,
                entry_node=entry,
                priority=handler_priority.get(kind, 100),
            )
        )
        builder.nodes[entry].meta["graph_role"] = kind

    ir_scenarios: dict[str, IrScenarioEntry] = {}
    for name, steps in scenarios_raw.items():
        entry, step_nodes = _lower_scenario_steps(builder, steps)
        ir_scenarios[name] = IrScenarioEntry(name=name, entry_node=entry, step_nodes=step_nodes)
        builder.connect(entry, f"scenario:{name}", EdgeKind.SCENARIO)

    ir_blocks: dict[str, IrBlockEntry] = {}
    for name, block in blocks_raw.items():
        body = getattr(block, "body", [])
        entry, _exit = builder.lower_body(body)
        ir_blocks[name] = IrBlockEntry(name=name, entry_node=entry)
        builder.connect(entry, f"block:{name}", EdgeKind.BLOCK)

    graph = IrProgramGraph(
        name=str(config.get("name", "bot")),
        config=config,
        globals=dict(getattr(program, "globals", {})),
        nodes=builder.nodes,
        edges=builder.edges,
        handlers=sorted(ir_handlers, key=lambda h: h.priority),
        scenarios=ir_scenarios,
        blocks=ir_blocks,
    )
    return ast, graph
