"""NativeOps — graph effect primitives (sole runtime execution registry)."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from cicada_platform.compiler.ops_manifest import LEGACY_OPS
from cicada_platform.runtime.native_core import async_actions, flow_control, messaging, storage
from cicada_platform.runtime.services import RuntimeServices

NativeOpFn = Callable[[RuntimeServices, Any, Any], None]

# Orchestrated by GraphExecutionEngine only (not NativeOps body execution)
GRAPH_ORCHESTRATED_OPS = frozenset(
    {
        "If",
        "ForEach",
        "WhileLoop",
        "Noop",
        "StartScenario",
        "Step",
        "EndScenario",
        "ReturnFromScenario",
        "RepeatStep",
        "GotoStep",
        "UseBlock",
        "CallBlock",
        "Timeout",
    }
)


def _op(fn: Callable) -> NativeOpFn:
    def wrapper(services: RuntimeServices, stmt: Any, ctx: Any) -> None:
        fn(services.native, stmt, ctx)

    return wrapper


NATIVE_OPS: dict[str, NativeOpFn] = {
    "Reply": _op(messaging.apply_reply),
    "RandomReply": _op(messaging.apply_random_reply),
    "Ask": _op(messaging.apply_ask),
    "Buttons": _op(messaging.apply_buttons),
    "InlineButton": _op(messaging.apply_inline_button),
    "InlineKeyboard": _op(messaging.apply_inline_keyboard),
    "InlineKeyboardFromList": _op(messaging.apply_inline_keyboard_from_list),
    "InlineKeyboardFromDB": _op(messaging.apply_inline_keyboard_from_db),
    "Photo": _op(messaging.apply_photo),
    "Sticker": _op(messaging.apply_sticker),
    "ForwardPhoto": _op(messaging.apply_forward_photo),
    "PhotoVar": _op(messaging.apply_photo_var),
    "SendMarkdown": _op(messaging.apply_send_markdown),
    "SendHTML": _op(messaging.apply_send_html),
    "SendMarkdownV2": _op(messaging.apply_send_markdown_v2),
    "SendDocument": _op(messaging.apply_send_document),
    "SendAudio": _op(messaging.apply_send_audio),
    "SendVideo": _op(messaging.apply_send_video),
    "SendVoice": _op(messaging.apply_send_voice),
    "SendLocation": _op(messaging.apply_send_location),
    "SendContact": _op(messaging.apply_send_contact),
    "SendPoll": _op(messaging.apply_send_poll),
    "SendInvoice": _op(messaging.apply_send_invoice),
    "SendGame": _op(messaging.apply_send_game),
    "ForwardMsg": _op(messaging.apply_forward_msg),
    "Remember": _op(flow_control.apply_remember),
    "GlobalVar": _op(flow_control.apply_global_var),
    "SaveFile": _op(flow_control.apply_save_file),
    "Log": _op(flow_control.apply_log),
    "ReturnValue": _op(flow_control.apply_return_value),
    "BreakLoop": _op(flow_control.apply_break),
    "ContinueLoop": _op(flow_control.apply_continue),
    "SaveToDB": _op(storage.apply_save_to_db),
    "LoadFromDB": _op(storage.apply_load_from_db),
    "DeleteFromDB": _op(storage.apply_delete_from_db),
    "GetAllDBKeys": _op(storage.apply_get_all_db_keys),
    "SaveGlobalDB": _op(storage.apply_save_global_db),
    "LoadFromUserDB": _op(storage.apply_load_from_user_db),
    "LoadJson": _op(storage.apply_load_json),
    "ParseJson": _op(storage.apply_parse_json),
    "SaveJson": _op(storage.apply_save_json),
    "DeleteFile": _op(storage.apply_delete_file),
    "DeleteDictKey": _op(storage.apply_delete_dict_key),
    "SetDictKey": _op(storage.apply_set_dict_key),
    "HttpGet": _op(async_actions.apply_http_get),
    "HttpPost": _op(async_actions.apply_http_post),
    "HttpPatch": _op(async_actions.apply_http_patch),
    "HttpPut": _op(async_actions.apply_http_put),
    "HttpDelete": _op(async_actions.apply_http_delete),
    "SetHttpHeaders": _op(async_actions.apply_set_http_headers),
    "FetchJson": _op(async_actions.apply_fetch_json),
    "Sleep": _op(async_actions.apply_sleep),
    "TelegramAPI": _op(async_actions.apply_tg_api),
    "Notify": _op(async_actions.apply_notify),
    "Broadcast": _op(async_actions.apply_broadcast),
    "CheckSubscription": _op(async_actions.apply_check_subscription),
    "GetChatMemberRole": _op(async_actions.apply_get_chat_member_role),
    "DownloadFile": _op(async_actions.apply_download_file),
}

# Manifest includes graph-orchestrated op names for IR coverage
assert set(LEGACY_OPS) <= set(NATIVE_OPS.keys()) | GRAPH_ORCHESTRATED_OPS
