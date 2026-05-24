#!/usr/bin/env python3
"""
Parse aiogram 3 bot Python sources via AST.
Reads a .zip archive or a single .py file; emits JSON on stdout.
"""

from __future__ import annotations

import ast
import io
import json
import re
import sys
import zipfile
from pathlib import PurePosixPath
from typing import Any


def _unparse(node: ast.AST | None) -> str:
    if node is None:
        return ""
    try:
        return ast.unparse(node)
    except Exception:
        return ""


def _const_str(node: ast.AST | None) -> str | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def _call_name(node: ast.AST | None) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        base = _call_name(node.value)
        return f"{base}.{node.attr}" if base else node.attr
    if isinstance(node, ast.Call):
        return _call_name(node.func)
    return None


def _decorator_router_kind(dec: ast.AST) -> dict[str, Any] | None:
    """@router.message(...) / @router.callback_query(...)"""
    if not isinstance(dec, ast.Call):
        return None
    fn = dec.func
    if not isinstance(fn, ast.Attribute):
        return None
    if not isinstance(fn.value, ast.Name) or fn.value.id != "router":
        return None
    channel = fn.attr
    if channel not in ("message", "callback_query", "edited_message", "inline_query"):
        return None

    filters: list[dict[str, Any]] = []
    for arg in dec.args:
        parsed = _parse_filter_expr(arg)
        if parsed:
            filters.append(parsed)
    for kw in dec.keywords:
        parsed = _parse_filter_expr(kw.value)
        if parsed:
            filters.append(parsed)

    return {"channel": channel, "filters": filters}


def _parse_filter_expr(node: ast.AST) -> dict[str, Any] | None:
    if isinstance(node, ast.Call):
        name = _call_name(node.func)
        if name == "CommandStart":
            return {"kind": "CommandStart"}
        if name == "Command":
            cmd = None
            if node.args:
                cmd = _const_str(node.args[0])
            return {"kind": "Command", "cmd": cmd or _unparse(node.args[0]) if node.args else ""}
        if name == "StateFilter":
            return {"kind": "StateFilter", "expr": _unparse(node)}
        if name and name.startswith("F."):
            return {"kind": "F", "expr": _unparse(node)}
        return {"kind": "Call", "name": name or _unparse(node.func), "expr": _unparse(node)}
    if isinstance(node, ast.Compare):
        left = _unparse(node.left)
        for op, comp in zip(node.ops, node.comparators):
            if isinstance(op, ast.Eq):
                right = _const_str(comp) or _unparse(comp)
                if "F.data" in left or left.strip() == "F.data":
                    return {"kind": "callback_data", "op": "==", "value": right}
                if "startswith" in left or (
                    isinstance(node.left, ast.Call)
                    and getattr(getattr(node.left, "func", None), "attr", None) == "startswith"
                ):
                    return {"kind": "callback_data", "op": "startswith", "value": right}
        return {"kind": "Compare", "expr": _unparse(node)}
    if isinstance(node, ast.Attribute) and _call_name(node) == "F.text":
        return {"kind": "F", "expr": "F.text"}
    return {"kind": "expr", "expr": _unparse(node)}


def _extract_actions(body: list[ast.stmt]) -> list[dict[str, Any]]:
    actions: list[dict[str, Any]] = []

    def walk(stmts: list[ast.stmt]) -> None:
        for stmt in stmts:
            if isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Await):
                act = _action_from_await(stmt.value.value)
                if act:
                    actions.append(act)
            elif isinstance(stmt, ast.Await):
                act = _action_from_await(stmt.value)
                if act:
                    actions.append(act)
            elif isinstance(stmt, ast.If):
                walk(stmt.body)
                walk(stmt.orelse)
            elif isinstance(stmt, ast.Try):
                walk(stmt.body)
                for h in stmt.handlers:
                    walk(h.body)
                walk(stmt.orelse)
                walk(stmt.finalbody)
            elif isinstance(stmt, ast.With):
                walk(stmt.body)
            elif isinstance(stmt, ast.For):
                walk(stmt.body)
            elif isinstance(stmt, ast.While):
                walk(stmt.body)
            elif isinstance(stmt, ast.Assign):
                pass

    walk(body)
    return actions


def _action_from_await(node: ast.AST) -> dict[str, Any] | None:
    if not isinstance(node, ast.Call):
        return None
    target = _unparse(node.func)
    if not target:
        return None

    kwargs = {kw.arg: _unparse(kw.value) for kw in node.keywords if kw.arg}
    text = kwargs.get("text")
    if text is None and node.args:
        text = _const_str(node.args[0]) or _unparse(node.args[0])

    if target.endswith(".answer") or target.endswith(".reply"):
        return {"type": "answer", "text": text or "", "target": target}
    if target.endswith(".edit_text"):
        return {"type": "edit_text", "text": text or "", "target": target}
    if target.endswith(".set_state"):
        state_expr = _unparse(node.args[0]) if node.args else kwargs.get("state", "")
        return {"type": "set_state", "state": state_expr}
    if target.endswith(".clear"):
        return {"type": "clear_state"}
    if target.endswith(".update_data"):
        return {"type": "update_data", "expr": _unparse(node)}
    return {"type": "call", "target": target, "expr": _unparse(node)}


def _class_bases_name(node: ast.ClassDef) -> list[str]:
    names = []
    for base in node.bases:
        n = _call_name(base) or _unparse(base)
        if n:
            names.append(n)
    return names


def _extract_fsm_classes(tree: ast.Module) -> list[dict[str, Any]]:
    groups: list[dict[str, Any]] = []
    for node in tree.body:
        if not isinstance(node, ast.ClassDef):
            continue
        bases = _class_bases_name(node)
        if not any("StatesGroup" in b for b in bases):
            continue
        states = []
        for item in node.body:
            if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                states.append({"name": item.target.id, "line": item.lineno})
            elif isinstance(item, ast.Assign):
                for tgt in item.targets:
                    if isinstance(tgt, ast.Name):
                        val = _call_name(item.value) if isinstance(item.value, ast.Call) else None
                        if val == "State" or (val and val.endswith(".State")):
                            states.append({"name": tgt.id, "line": item.lineno})
        groups.append(
            {
                "name": node.name,
                "line": node.lineno,
                "states": states,
            }
        )
    return groups


def _handler_kind(channel: str, filters: list[dict[str, Any]]) -> str:
    if channel == "callback_query":
        for f in filters:
            if f.get("kind") == "callback_data":
                return "callback"
            if f.get("kind") == "F" and "data" in str(f.get("expr", "")):
                return "callback"
        return "callback"
    for f in filters:
        if f.get("kind") == "CommandStart":
            return "start"
        if f.get("kind") == "Command":
            return "command"
        if f.get("kind") == "callback_data":
            return "callback"
        if f.get("kind") == "F" and "text" in str(f.get("expr", "")):
            return "callback"
    return "on_message"


def _handler_payload(kind: str, filters: list[dict[str, Any]]) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    if kind == "command":
        for f in filters:
            if f.get("kind") == "Command" and f.get("cmd"):
                payload["cmd"] = f["cmd"]
                break
    if kind == "callback":
        for f in filters:
            if f.get("kind") == "callback_data":
                if f.get("op") == "startswith":
                    payload["dataPrefix"] = f.get("value", "")
                else:
                    payload["data"] = f.get("value", "")
                break
    if kind == "start":
        payload["cmd"] = "start"
    return payload


def _extract_handlers(tree: ast.Module, filename: str) -> list[dict[str, Any]]:
    handlers: list[dict[str, Any]] = []
    for node in tree.body:
        if not isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)):
            continue
        router_dec = None
        for dec in node.decorator_list:
            parsed = _decorator_router_kind(dec)
            if parsed:
                router_dec = parsed
                break
        if not router_dec:
            continue
        channel = router_dec["channel"]
        filters = router_dec.get("filters") or []
        kind = _handler_kind(channel, filters)
        handlers.append(
            {
                "name": node.name,
                "file": filename,
                "line": node.lineno,
                "channel": channel,
                "kind": kind,
                "filters": filters,
                "payload": _handler_payload(kind, filters),
                "actions": _extract_actions(node.body),
                "async": isinstance(node, ast.AsyncFunctionDef),
            }
        )
    return handlers


def _extract_bot_token(source: str) -> str | None:
    m = re.search(r'BOT_TOKEN\s*=\s*["\']([^"\']+)["\']', source)
    if m:
        return m.group(1)
    m = re.search(
        r'getenv\s*\(\s*["\']BOT_TOKEN["\']\s*,\s*["\']([^"\']+)["\']',
        source,
    )
    if m:
        return m.group(1)
    m = re.search(r'Token\s*\(\s*["\']([^"\']+)["\']', source)
    if m:
        return m.group(1)
    return None


def parse_python_source(source: str, filename: str) -> dict[str, Any]:
    tree = ast.parse(source, filename=filename)
    return {
        "file": filename,
        "handlers": _extract_handlers(tree, filename),
        "fsm": {"groups": _extract_fsm_classes(tree)},
        "botToken": _extract_bot_token(source),
    }


def _is_python_path(path: str) -> bool:
    name = PurePosixPath(path.replace("\\", "/")).name
    return name.endswith(".py") and not name.startswith("__")


def _score_entrypoint(path: str) -> int:
    name = PurePosixPath(path.replace("\\", "/")).name.lower()
    score = 0
    if name == "bot.py":
        score += 100
    if name == "main.py":
        score += 80
    if "bot" in name:
        score += 40
    if name == "__init__.py":
        score -= 50
    depth = len(PurePosixPath(path.replace("\\", "/")).parts)
    score -= depth
    return score


def load_sources_from_zip(data: bytes) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        names = sorted(
            (n for n in zf.namelist() if _is_python_path(n) and not n.endswith("/")),
            key=lambda p: (-_score_entrypoint(p), p),
        )
        for name in names:
            try:
                raw = zf.read(name).decode("utf-8")
            except UnicodeDecodeError:
                raw = zf.read(name).decode("utf-8", errors="replace")
            out.append((name.replace("\\", "/"), raw))
    return out


def parse_archive(data: bytes) -> dict[str, Any]:
    if data[:2] == b"PK":
        sources = load_sources_from_zip(data)
    else:
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            text = data.decode("utf-8", errors="replace")
        sources = [("bot.py", text)]

    if not sources:
        return {"ok": False, "error": "no_python_sources", "files": [], "handlers": [], "fsm": {"groups": []}}

    files: list[str] = []
    handlers: list[dict[str, Any]] = []
    fsm_groups: list[dict[str, Any]] = []
    bot_token: str | None = None

    for path, source in sources:
        files.append(path)
        parsed = parse_python_source(source, path)
        if parsed.get("botToken") and not bot_token:
            bot_token = parsed["botToken"]
        handlers.extend(parsed["handlers"])
        fsm_groups.extend(parsed["fsm"]["groups"])

    return {
        "ok": True,
        "files": files,
        "handlers": handlers,
        "fsm": {"groups": fsm_groups},
        "botToken": bot_token,
    }


def main() -> None:
    if len(sys.argv) < 2:
        data = sys.stdin.buffer.read()
    else:
        path = sys.argv[1]
        with open(path, "rb") as f:
            data = f.read()
    result = parse_archive(data)
    json.dump(result, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
