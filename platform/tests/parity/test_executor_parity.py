"""IR parity: DSL → graph → execution vs legacy executor (mock transport)."""

from __future__ import annotations

import pytest

from cicada_platform.compiler.pipeline import CompilePipeline
from cicada_platform.runtime.parity.harness import (
    assert_native_never_calls_handle,
    effects_from_graph_engine,
    effects_from_legacy_oracle,
    graph_covers_legacy_ops,
    run_parity,
)

HEADER = '# Cicada3301\nбот "TOKEN"\n'

UPDATE_TEXT = {
    "message": {
        "message_id": 1,
        "chat": {"id": 1, "type": "private"},
        "from": {"id": 1, "first_name": "T"},
        "text": "go",
    }
}

UPDATE_START = {**UPDATE_TEXT, "message": {**UPDATE_TEXT["message"], "text": "/start"}}
UPDATE_HELP = {**UPDATE_TEXT, "message": {**UPDATE_TEXT["message"], "text": "/help"}}

CALLBACK_HELLO = {
    "callback_query": {
        "id": "cb1",
        "from": {"id": 1, "first_name": "T"},
        "data": "hello",
        "message": {
            "message_id": 2,
            "chat": {"id": 1, "type": "private"},
        },
    }
}


PARITY_CASES: list[tuple[str, str, dict]] = [
    ("start_greeting", "при старте:\n    ответ \"Hi\"\n", UPDATE_START),
    ("command_help", 'при команде "/help":\n    ответ \"Help text\"\n', UPDATE_HELP),
    (
        "callback_exact",
        'при нажатии "hello":\n    ответ "CB ok"\n',
        CALLBACK_HELLO,
    ),
    (
        "else_echo",
        "иначе:\n    ответ \"Echo: {текст}\"\n",
        UPDATE_TEXT,
    ),
    (
        "buttons_reply",
        "при старте:\n    ответ \"Pick\"\n    кнопки \"A\" \"B\"\n",
        UPDATE_START,
    ),
    (
        "remember_var",
        "при старте:\n    запомни x = 42\n    ответ \"Val {x}\"\n",
        UPDATE_START,
    ),
    (
        "if_true",
        "при старте:\n    запомни flag = 1\n    если flag == 1:\n        ответ \"yes\"\n    иначе:\n        ответ \"no\"\n",
        UPDATE_START,
    ),
    (
        "if_false",
        "при старте:\n    запомни flag = 0\n    если flag == 1:\n        ответ \"yes\"\n    иначе:\n        ответ \"no\"\n",
        UPDATE_START,
    ),
    (
        "random_reply",
        "при старте:\n    рандом:\n        \"A\"\n        \"B\"\n        \"C\"\n",
        UPDATE_START,
    ),
    (
        "log_and_reply",
        "при старте:\n    лог \"trace\"\n    ответ \"done\"\n",
        UPDATE_START,
    ),
    (
        "text_handler",
        "при тексте \"ping\":\n    ответ \"pong\"\n",
        {**UPDATE_TEXT, "message": {**UPDATE_TEXT["message"], "text": "ping"}},
    ),
    (
        "multi_reply_flush",
        "при старте:\n    ответ \"Line1\"\n    ответ \"Line2\"\n",
        UPDATE_START,
    ),
    (
        "inline_single",
        'при старте:\n    кнопка "Go" -> "go_cb"\n',
        UPDATE_START,
    ),
    (
        "global_var",
        "при старте:\n    глобально counter = 1\n    ответ \"ok\"\n",
        UPDATE_START,
    ),
    (
        "save_load_db",
        'при старте:\n    сохранить "k" = 7\n    получить "k" → v\n    ответ "DB {v}"\n',
        UPDATE_START,
    ),
    (
        "notify_user",
        "при старте:\n    уведомить 999 \"hi\"\n    ответ \"sent\"\n",
        UPDATE_START,
    ),
    (
        "reply_keyboard_as_text",
        'при нажатии "Menu":\n    ответ "menu ok"\n',
        {**UPDATE_TEXT, "message": {**UPDATE_TEXT["message"], "text": "Menu"}},
    ),
    (
        "markdown",
        'при старте:\n    ответ_md "*bold*"\n',
        UPDATE_START,
    ),
    (
        "html_message",
        'при старте:\n    ответ_html "<b>x</b>"\n',
        UPDATE_START,
    ),
    (
        "sleep_then_reply",
        "при старте:\n    пауза 0\n    ответ \"after\"\n",
        UPDATE_START,
    ),
]


@pytest.mark.parametrize("name,dsl_body,update", PARITY_CASES, ids=[c[0] for c in PARITY_CASES])
def test_full_update_parity(name: str, dsl_body: str, update: dict) -> None:
    dsl = HEADER + dsl_body
    if name == "random_reply":
        import random

        random.seed(0)
        legacy = effects_from_legacy_oracle(dsl, update)
        random.seed(0)
        platform = effects_from_graph_engine(dsl, update, native=True)
        assert legacy == platform, f"random_reply: legacy={legacy!r} platform={platform!r}"
        return
    legacy, platform, ok = run_parity(dsl, update)
    assert ok, f"{name}: legacy={legacy!r} platform={platform!r}"


def test_ask_resume_parity() -> None:
    dsl = HEADER + (
        "при старте:\n"
        "    спросить \"Name?\" → name\n"
        "    ответ \"Hi {name}\"\n"
    )
    u1 = UPDATE_START
    u2 = {**UPDATE_TEXT, "message": {**UPDATE_TEXT["message"], "text": "Ann"}}
    l1 = effects_from_legacy_oracle(dsl, u1)
    p1 = effects_from_graph_engine(dsl, u1, native=True)
    assert l1 == p1
    l2 = effects_from_legacy_oracle(dsl, u2)
    p2 = effects_from_graph_engine(dsl, u2, native=True)
    assert l2 == p2


def test_graph_covers_all_handler_ops() -> None:
    dsl = HEADER + (
        "при старте:\n    ответ \"a\"\n"
        "    кнопки \"X\"\n"
        "    спросить \"?\" → q\n"
    )
    legacy_ops, graph_ops = graph_covers_legacy_ops(dsl)
    assert legacy_ops <= graph_ops, f"missing ops: {legacy_ops - graph_ops}"


def test_native_mode_never_calls_executor_handle() -> None:
    assert_native_never_calls_handle(HEADER + "при старте:\n    ответ \"Hi\"\n", UPDATE_START)


def test_compile_produces_graph_nodes_for_every_stmt() -> None:
    dsl = HEADER + (
        "при старте:\n"
        "    если 1:\n"
        "        ответ \"t\"\n"
        "    иначе:\n"
        "        ответ \"f\"\n"
    )
    result = CompilePipeline().compile(dsl)
    assert len(result.graph.nodes) >= 4
    assert any(n.op == "If" for n in result.graph.nodes.values())
    assert any(e.kind.value == "true" for e in result.graph.edges)
