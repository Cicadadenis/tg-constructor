# Migration Readiness (Graph as SoT)

## Status: Graph-native execution enabled

Set `CICADA_GRAPH_NATIVE_MODE=1` to enforce:

- **No** `Executor.handle()` on the hot path
- **No** runtime `_dispatch` lookup (pre-bound handler map at init)
- Routing via **graph entry nodes** (`runtime/entry.py`)
- Traversal via **`GraphExecutionEngine._run_graph`**
- Scenario FSM via **`ScenarioGraphRunner`** + graph step nodes
- Suspend/resume via **`Ask`** + `SUSPEND_RESUME` edges + `ctx._graph_resume_node`

## Architecture inversion

| Layer | Role |
|-------|------|
| `GraphExecutionEngine` | **Primary** — routing, traversal, trace |
| `NativeOpRegistry` | **Primary** — 58 ops pre-bound from legacy `_exec_*` (no dispatch table at runtime) |
| `LegacyStatementFallback` | Unregistered op / `exec_body` tails only |
| `LegacyOracle` | Parity tests oracle only (`runtime/legacy_bridge.py`) |

## Parity

```bash
cd platform && pytest tests/parity -q
```

- 20+ scenarios: `GraphEngine` vs `LegacyOracle` outbound
- `test_native_mode_never_calls_executor_handle` guards native mode

## Handler model

There is **no** runtime handler dispatch table. Each handler in IR is:

```json
{ "kind": "start|command|callback|text|before_each|after_each|else|...", "entry_node": "n_..." }
```

`before_each` / `after_each` are graph entry nodes executed around the matched handler chain.

## Remaining incremental work

- Move op implementations from bound `_exec_*` into `runtime/ops/native/*.py` (true platform code)
- Scenario `_pending_stmts` tail as graph subgraph (today: `fallback.exec_body`)
- Shrink `FALLBACK_OPS` to zero
