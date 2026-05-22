"""Graph entry resolution — handlers are graph entry nodes (no runtime dispatch table)."""

from __future__ import annotations

from cicada_platform.core.schemas.ir_graph import IrHandlerEntry, IrProgramGraph


def handlers_by_role(graph: IrProgramGraph, role: str | tuple[str, ...]) -> list[IrHandlerEntry]:
    if isinstance(role, tuple):
        roles = set(role)
        return [h for h in graph.handlers if h.kind in roles]
    return [h for h in graph.handlers if h.kind == role]


def resolve_message_entries(graph: IrProgramGraph, text: str) -> list[str]:
    """Return ordered graph entry node ids to execute."""
    entries: list[str] = []

    if text == "/start":
        for h in handlers_by_role(graph, "start"):
            entries.append(h.entry_node)
        return entries

    if text.startswith("/"):
        cmd = text.split()[0]
        for h in handlers_by_role(graph, "command"):
            if h.trigger == cmd:
                entries.append(h.entry_node)
        return entries

    for h in handlers_by_role(graph, "text"):
        if h.trigger is not None and h.trigger.strip().lower() != text.strip().lower():
            continue
        entries.append(h.entry_node)

    for h in handlers_by_role(graph, "callback"):
        if h.trigger and h.trigger.strip() == text.strip():
            entries.append(h.entry_node)

    if not entries:
        for h in handlers_by_role(graph, ("any", "else")):
            entries.append(h.entry_node)
            break

    return entries


def resolve_callback_entries(graph: IrProgramGraph, data: str) -> list[str]:
    entries: list[str] = []
    for h in handlers_by_role(graph, "callback"):
        if h.trigger == data:
            entries.append(h.entry_node)
            return entries
    for h in handlers_by_role(graph, "callback_prefix"):
        if h.trigger and data.startswith(h.trigger):
            entries.append(h.entry_node)
            return entries
    for h in handlers_by_role(graph, "callback"):
        if h.trigger is None:
            entries.append(h.entry_node)
            return entries
    return entries


def resolve_media_entries(graph: IrProgramGraph, media_kind: str) -> list[str]:
    return [h.entry_node for h in graph.handlers if h.kind == media_kind]
