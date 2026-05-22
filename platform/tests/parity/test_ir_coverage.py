"""Every legacy Executor dispatch op must appear in graph lowering."""

from __future__ import annotations

from cicada_platform.compiler.legacy_bridge import ensure_legacy_path

EXPECTED_OPS = {
    "Reply",
    "Ask",
    "Remember",
    "If",
    "Buttons",
    "InlineButton",
    "InlineKeyboard",
    "InlineKeyboardFromList",
    "InlineKeyboardFromDB",
    "Photo",
    "Sticker",
    "ForwardPhoto",
    "SaveFile",
    "StartScenario",
    "SendMarkdown",
    "SendHTML",
    "SendMarkdownV2",
    "SendDocument",
    "SendAudio",
    "SendVideo",
    "SendVoice",
    "SendLocation",
    "SendContact",
    "SendPoll",
    "SendInvoice",
    "SendGame",
    "DownloadFile",
    "Step",
    "EndScenario",
    "ReturnFromScenario",
    "RepeatStep",
    "GotoStep",
    "SaveToDB",
    "LoadFromDB",
    "HttpGet",
    "HttpPost",
    "Log",
    "Sleep",
    "TelegramAPI",
    "UseBlock",
    "RandomReply",
    "GlobalVar",
    "PhotoVar",
    "ForEach",
    "WhileLoop",
    "BreakLoop",
    "ContinueLoop",
    "Timeout",
    "Notify",
    "Broadcast",
    "CheckSubscription",
    "GetChatMemberRole",
    "ForwardMsg",
    "LoadJson",
    "ParseJson",
    "SaveJson",
    "DeleteFile",
    "DeleteDictKey",
    "SetDictKey",
    "HttpPatch",
    "HttpPut",
    "HttpDelete",
    "SetHttpHeaders",
    "FetchJson",
    "DeleteFromDB",
    "GetAllDBKeys",
    "SaveGlobalDB",
    "LoadFromUserDB",
    "ReturnValue",
    "CallBlock",
}


def test_executor_dispatch_ops_documented():
    ensure_legacy_path()
    from cicada.adapters.mock_telegram import MockTelegramAdapter
    from cicada.executor import Executor  # type: ignore
    from cicada.parser import Parser

    ex = Executor(Parser('бот "T"\n').parse(), MockTelegramAdapter())
    ops = {cls.__name__ for cls in ex._dispatch}
    assert ops == EXPECTED_OPS, f"drift: extra={ops - EXPECTED_OPS} missing={EXPECTED_OPS - ops}"


def test_graph_lowering_supports_all_ops_in_minimal_program():
    """Synthetic program references major op families via parser."""
    from cicada_platform.compiler.pipeline import CompilePipeline
    from cicada_platform.runtime.parity.harness import graph_covers_legacy_ops

    dsl = """# Cicada3301
бот "TOKEN"
при старте:
    ответ "a"
    спросить "?" → q
    запомни q = 1
    если q == 1:
        ответ "yes"
    иначе:
        ответ "no"
    пауза 0
    лог "x"
"""
    legacy_ops, graph_ops = graph_covers_legacy_ops(dsl)
    assert legacy_ops <= graph_ops
    result = CompilePipeline().compile(dsl)
    assert len(result.graph.nodes) >= len(legacy_ops)
