# Legacy Executor Audit (`cic-st-core/cicada/executor.py`)

> Source: `Executor` dispatch table + `_handle_message` / `_handle_callback` routing (~2332 lines).

## Handler kinds (inbound routing)

| Kind | Trigger | Priority / notes |
|------|---------|------------------|
| `before_each` | — | Runs before every message/callback |
| `start` | — | `/start` exact |
| `command` | `/cmd` | First token match |
| `callback` | exact data | Before prefix/general |
| `callback_prefix` | prefix | `data.startswith(trigger)` |
| `callback` | `None` | General inline router |
| `text` | optional exact | Case-insensitive if trigger set |
| `callback` + text | reply keyboard | Text equals trigger label |
| `photo_received` | — | Media handlers |
| `document_received` | — | |
| `voice_received` | — | audio → voice_received |
| `sticker_received` | — | |
| `location_received` | — | |
| `contact_received` | — | |
| `any` / `else` | — | Fallback |
| `after_each` | — | Always after handler chain |

## Statement ops (`_dispatch` — 58 types)

| Op | Category | Side effects |
|----|----------|--------------|
| `Reply` | message | pending message buffer → flush |
| `RandomReply` | message | variant pick |
| `Ask` | input | **suspend** `waiting_for`, `_pending_stmts` |
| `Remember` | state | `ctx.set` |
| `If` | control | branch then/else bodies |
| `Buttons` | UI | pending reply keyboard matrix |
| `InlineButton` | UI | inline single |
| `InlineKeyboard` | UI | inline matrix |
| `InlineKeyboardFromList` | UI | dynamic inline from var |
| `InlineKeyboardFromDB` | UI | catalog inline from KV |
| `Photo` / `PhotoVar` | media | send_photo |
| `Sticker` | media | send_sticker |
| `ForwardPhoto` | media | forward |
| `SaveFile` | media | download to path |
| `SendDocument/Audio/Video/Voice` | media | send_* |
| `SendMarkdown/HTML/MarkdownV2` | message | formatted |
| `SendLocation/Contact/Poll/Invoice/Game` | platform | PlatformEffect + tg |
| `DownloadFile` | media | file IO |
| `StartScenario` | flow | FSM scenario start |
| `Step` | flow | scenario step body |
| `EndScenario` | flow | clear scenario |
| `ReturnFromScenario` | flow | `_return_requested` |
| `RepeatStep` | flow | step -= 2, `_repeat_requested` |
| `GotoStep` | flow | command/scenario/step jump |
| `UseBlock` / `CallBlock` | flow | block subgraph |
| `ForEach` | loop | break/continue signals |
| `WhileLoop` | loop | max 100k iters |
| `BreakLoop` / `ContinueLoop` | loop | signals |
| `Timeout` | loop | thread pool timeout |
| `SaveToDB` / `LoadFromDB` | storage | per-user KV |
| `SaveGlobalDB` / `LoadFromUserDB` | storage | global / cross-user |
| `DeleteFromDB` / `GetAllDBKeys` | storage | |
| `HttpGet/Post/Patch/Put/Delete` | http | ctx var assignment |
| `FetchJson` / `SetHttpHeaders` | http | |
| `LoadJson` / `ParseJson` / `SaveJson` | data | file/JSON |
| `DeleteFile` / `DeleteDictKey` / `SetDictKey` | data | |
| `Log` | debug | stdout |
| `Sleep` | control | blocking sleep |
| `TelegramAPI` | **telegram** | raw `tg.call` |
| `Notify` / `Broadcast` | messaging | multi-chat send |
| `CheckSubscription` | **telegram** | getChatMember |
| `GetChatMemberRole` | **telegram** | status → var |
| `ForwardMsg` | **telegram** | forwardMessage |
| `GlobalVar` | state | global dict |
| `ReturnValue` | flow | scenario return value |

## Control-flow edge cases

- **Pending message coalescing**: `Reply` + `Buttons` merge until `_flush`
- **Ask suspend**: stops body mid-list; resume runs `_pending_stmts` or scenario tail
- **Scenario auto-advance**: after step body, increment step unless repeat/return
- **Media + waiting_for**: fills variable from file_id/location/contact
- **Callback answer**: always `answerCallbackQuery` (best-effort)
- **FSM transition flag**: `_transition_made` → `_continue_scenario`

## Telegram-specific (must stay in transport)

- `TelegramAPI`, `CheckSubscription`, `GetChatMemberRole`, `ForwardMsg`
- `answer_callback`, raw Bot API `call`
- Inline callback encoding (`cb_`, `h:` hashes)

## Core effects (platform-agnostic)

`MessageEffect`, `ButtonsEffect`, `InlineKeyboardEffect`, `MediaEffect`, `PlatformEffect`

## Parity target

All ops lowered to **graph nodes** (`op` + serialized payload). Execution via `LegacyStmtRunner` delegates to `Executor._exec` until native handlers reach 1:1 effects.
