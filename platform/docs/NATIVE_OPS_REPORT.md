# Native Ops Migration Report

**Execution path (target):** `Graph → NativeOps → Effects`  
**Oracle path (tests only):** `LegacyOracle → cicada.executor.Executor`

## Summary

| Category | Count | Notes |
|----------|------:|-------|
| Fully native (registered in `runtime/ops/native/`) | 58 | All `LEGACY_OPS` manifest ops |
| Graph control (not via registry body) | 5 | `If`, `ForEach`, `WhileLoop`, `Noop`, `StartScenario` |
| Legacy runtime fallback | 0 | Removed — `LegacyStatementFallback` is compile-time warnings only |
| LegacyExecutor on graph path | 0 | `GraphExecutionEngine` uses `RuntimeServices` + `NativeRuntime` |

## Environment flags

| Flag | Purpose |
|------|---------|
| `CICADA_GRAPH_NATIVE_MODE=1` | Graph routing + native ops (default in parity tests) |
| `CICADA_RUNTIME_STRICT=1` | Missing native op → `NativeOpNotImplementedError` (no silent fallback) |

## Op status

### Fully native (`runtime/ops/native/` → `native_core/runtime.py`)

All 58 manifest ops are registered and delegate to vendored `NativeRuntime._exec_*` logic (ported from legacy executor, no `Executor` class):

`Reply`, `Ask`, `Remember`, `If`, `Buttons`, `InlineButton`, `InlineKeyboard`, `InlineKeyboardFromList`, `InlineKeyboardFromDB`, `Photo`, `Sticker`, `ForwardPhoto`, `SaveFile`, `StartScenario`, `SendMarkdown`, `SendHTML`, `SendMarkdownV2`, `SendDocument`, `SendAudio`, `SendVideo`, `SendVoice`, `SendLocation`, `SendContact`, `SendPoll`, `SendInvoice`, `SendGame`, `DownloadFile`, `Step`, `EndScenario`, `ReturnFromScenario`, `RepeatStep`, `GotoStep`, `SaveToDB`, `LoadFromDB`, `HttpGet`, `HttpPost`, `Log`, `Sleep`, `TelegramAPI`, `UseBlock`, `RandomReply`, `GlobalVar`, `PhotoVar`, `ForEach`, `WhileLoop`, `BreakLoop`, `ContinueLoop`, `Timeout`, `Notify`, `Broadcast`, `CheckSubscription`, `GetChatMemberRole`, `ForwardMsg`, `LoadJson`, `ParseJson`, `SaveJson`, `DeleteFile`, `DeleteDictKey`, `SetDictKey`, `HttpPatch`, `HttpPut`, `HttpDelete`, `SetHttpHeaders`, `FetchJson`, `DeleteFromDB`, `GetAllDBKeys`, `SaveGlobalDB`, `LoadFromUserDB`, `ReturnValue`, `CallBlock`

### Graph-native control flow (not statement registry)

| Op | Handled by |
|----|------------|
| `If` | `GraphExecutionEngine._run_graph` + `EvalShim` |
| `ForEach` | `GraphExecutionEngine._run_foreach` |
| `WhileLoop` | `GraphExecutionEngine._run_while` |
| `StartScenario` | `ScenarioGraphRunner.start` |
| `Noop` | Graph traversal |

### Domain modules (graph-native, no executor vendoring)

| Module | Status |
|--------|--------|
| `native_core/conditions.py` | Expression engine |
| `native_core/messaging.py` | Outbound effects |
| `native_core/flow_control.py` | Variables / loop signals |
| `native_core/storage.py` | Persistence |
| `native_core/async_actions.py` | I/O side effects |
| `native_core/base.py` | `NativeRuntime` facade (no orchestration) |

Removed: `native_core/runtime.py`, `native_core/evaluator.py` (transitional executor copies).

### Legacy-only (must not run in graph path)

| Component | Allowed use |
|-----------|-------------|
| `cicada.executor.Executor` | `LegacyOracle` parity tests only |
| `LegacyStatementFallback` | Removed from runtime |
| `Executor.handle()` | Parity oracle only |

## Dependency boundary

```
runtime/ops/native/     → execution (NativeRuntime)
runtime/native_core/    → evaluator + statement impl (no Executor)
runtime/session.py      → UserSession / SessionRuntime
runtime/legacy_bridge.py → LegacyOracle (tests)
compiler/legacy_bridge.py → Parser / AST only
```

**Still imported (non-executor):** `cicada.parser` (AST types), `cicada.database`, `cicada.core` (effects), `cicada.security_utils` — infrastructure, not `cicada.executor` or `cicada.runtime`.

## Verification

```bash
cd platform
set CICADA_GRAPH_NATIVE_MODE=1
set CICADA_RUNTIME_STRICT=1
pytest tests/ -q
```

Parity suite compares mock `tg.outbound` from `LegacyOracle` vs `GraphExecutionEngine` without calling legacy during platform execution.
