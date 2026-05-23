"""Inbound routing — mirrors legacy _handle_message / _handle_callback."""

from __future__ import annotations

from typing import Any

from cicada_platform.core.schemas.ir_graph import IrHandlerEntry, IrProgramGraph
from cicada_platform.runtime.trace import ExecutionTrace, TraceEventKind


def select_handlers(graph: IrProgramGraph, *, kind: str, text: str = "", callback_data: str = "") -> list[IrHandlerEntry]:
    matched: list[IrHandlerEntry] = []
    if kind == "before_each":
        return [h for h in graph.handlers if h.kind == "before_each"]
    if kind == "after_each":
        return [h for h in graph.handlers if h.kind == "after_each"]
    if kind == "start":
        return [h for h in graph.handlers if h.kind == "start"]
    if kind == "command":
        cmd = text.split()[0] if text else ""
        return [h for h in graph.handlers if h.kind == "command" and h.trigger == cmd]
    if kind == "callback":
        for h in graph.handlers:
            if h.kind == "callback" and h.trigger == callback_data:
                matched.append(h)
                return matched
        for h in graph.handlers:
            if h.kind == "callback_prefix" and h.trigger and callback_data.startswith(h.trigger):
                matched.append(h)
                return matched
        for h in graph.handlers:
            if h.kind == "callback" and h.trigger is None:
                matched.append(h)
                return matched
        return matched
    if kind == "text":
        for h in graph.handlers:
            if h.kind == "text":
                if h.trigger is not None and h.trigger.strip().lower() != text.strip().lower():
                    continue
                matched.append(h)
            elif h.kind == "callback" and h.trigger and h.trigger.strip() == text.strip():
                matched.append(h)
                break
        return matched
    if kind == "media":
        return [h for h in graph.handlers if h.kind.endswith("_received")]
    if kind == "fallback":
        for h in graph.handlers:
            if h.kind in ("any", "else"):
                matched.append(h)
                break
    return matched


def route_update(
    graph: IrProgramGraph,
    update: dict,
    trace: ExecutionTrace,
) -> tuple[str, list[IrHandlerEntry], Any]:
    """Returns (route_kind, handlers_to_run, legacy_ctx) — ctx created by caller."""
    if "callback_query" in update:
        return "callback", [], None
    if "message" in update:
        msg = update["message"]
        text = msg.get("text", "")
        if text == "/start":
            trace.emit(TraceEventKind.HANDLER_MATCHED, route="start")
            return "start", select_handlers(graph, kind="start"), None
        if text.startswith("/"):
            trace.emit(TraceEventKind.HANDLER_MATCHED, route="command", cmd=text.split()[0])
            return "command", select_handlers(graph, kind="command", text=text), None
        media_kinds = ("photo", "document", "voice", "audio", "sticker", "location", "contact")
        if any(msg.get(k) for k in media_kinds):
            return "media", select_handlers(graph, kind="media"), None
        return "text", select_handlers(graph, kind="text", text=text), None
    return "unknown", [], None
