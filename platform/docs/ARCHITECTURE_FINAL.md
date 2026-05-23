# Cicada Platform — Final Execution Architecture

## Principle

**Graph IR is the single source of truth for control flow.**  
**NativeRuntime + NativeOps are the single source of truth for effects.**  
**Legacy `Executor` is an oracle only** (parity tests, never production graph path).

```
Compiler:  DSL → AST → IrProgramGraph
Runtime:   Inbound event → GraphExecutionEngine → nodes/edges → NativeOps → effects → transport
Oracle:    LegacyOracle → cicada.executor.Executor  (tests only)
```

## Layers

| Layer | Responsibility | Must NOT |
|-------|----------------|----------|
| **Graph IR** (`core/schemas/ir_graph.py`) | Nodes, edges, handlers as entry metadata | Execute statements |
| **GraphExecutionEngine** | Entry resolution, traversal, suspend/resume, loops, scenarios | Call `Executor.handle()` or `_dispatch` |
| **NativeOps** (`runtime/ops/native/`) | Registry: op name → effect primitive | Orchestrate graphs |
| **NativeRuntime** (`runtime/native_core/base.py`) | Session, transport, DB, effect list, evaluation facade | Run handler tables or scenario FSM |
| **Domain modules** | Pure effect primitives | Hidden execution paths |

### Domain modules (`runtime/native_core/`)

| Module | Role |
|--------|------|
| `conditions.py` | Expression evaluation, `LoopBreak` / `LoopContinue`, truthiness |
| `messaging.py` | Outbound messages, keyboards, media |
| `flow_control.py` | Variables, return flags, loop signals |
| `storage.py` | DB, JSON files, dict mutations |
| `async_actions.py` | HTTP, sleep, Telegram API, notify/broadcast |

## Production mode

Set both flags for strict graph-native production:

```bash
export CICADA_GRAPH_NATIVE_MODE=1
export CICADA_RUNTIME_STRICT=1
```

| Flag | Effect |
|------|--------|
| `CICADA_GRAPH_NATIVE_MODE=1` | Graph engine is authoritative; no legacy routing |
| `CICADA_RUNTIME_STRICT=1` | Unregistered op → `NativeOpNotImplementedError` (no fallback) |

With both enabled, runtime does not import or call `cicada.executor` on the execution path.

## Architectural rule (enforced in CI)

> **No execution logic outside `NativeRuntime` + `NativeOps` + `GraphExecutionEngine`.**

- **Orchestration** (which node runs next) → `GraphExecutionEngine` only  
- **Effects** (send message, DB write, HTTP) → `native_core/*` via `NativeOps`  
- **Legacy** → `runtime/legacy_bridge.py` (`LegacyOracle`) for expected output in tests  

Tests: `tests/test_architecture_boundary.py`, `runtime/architecture_guard.py`

## Graph-orchestrated ops

These appear in IR but are executed by the graph engine, not the op registry body:

`If`, `ForEach`, `WhileLoop`, `Noop`, `StartScenario`, `Step`, `EndScenario`, `ReturnFromScenario`, `RepeatStep`, `GotoStep`, `UseBlock`, `CallBlock`, `Timeout`

## Dependency boundary

| Allowed on native path | Forbidden on native path |
|------------------------|---------------------------|
| `cicada.parser` (AST types) | `cicada.executor.Executor` |
| `cicada.core` (effect types) | `LegacyStatementFallback` at runtime |
| `cicada.database`, `cicada.security_utils` | `_dispatch`, `_exec_body`, vendored executor copies |

## Verification

```bash
cd platform
export CICADA_GRAPH_NATIVE_MODE=1
export CICADA_RUNTIME_STRICT=1
pytest tests/ -q
```

See also: [NATIVE_OPS_REPORT.md](./NATIVE_OPS_REPORT.md), [EXECUTION_FLOW.md](./EXECUTION_FLOW.md).
