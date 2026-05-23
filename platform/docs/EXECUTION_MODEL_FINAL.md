# Execution Model (Final)

Three layers. No execution logic in `native_core` except **effects** and **expression compute**.

## Layers

```
┌─────────────────────────────────────────────────────────┐
│  Control Plane: GraphExecutionEngine                    │
│  IR graph · entry resolution · traverse nodes/edges     │
│  If / loops / scenarios / suspend-resume                │
└──────────────────────────┬──────────────────────────────┘
                           │ invokes op by name
┌──────────────────────────▼──────────────────────────────┐
│  Execution Layer: NativeOps + native_core                 │
│  Registry → messaging | storage | async_actions | …       │
│  NativeRuntime: session, effects[], transport, eval       │
└──────────────────────────┬──────────────────────────────┘
                           │ effects / I/O
┌──────────────────────────▼──────────────────────────────┐
│  IO Layer: transport (Telegram, …) · storage (DB, files)  │
└─────────────────────────────────────────────────────────┘
```

| Layer | Packages | Responsibility |
|-------|----------|----------------|
| **Control Plane** | `runtime/control_plane/*`, `entry.py`, `trace.py` | When and which op runs; graph traversal only |
| **Execution Layer** | `runtime/ops/native/`, `runtime/native_core/`, `runtime/services.py` | How an op produces effects (libc of the workflow engine) |
| **IO Layer** | `transport/`, `cicada.database`, `tg` adapters | External systems |

## Rule: `native_core` = NO ORCHESTRATION

`native_core` is a **pure effect runtime library**:

- Allowed: send message, HTTP call, DB read/write, sleep, expression eval, op signals (`LoopBreak`)
- Forbidden: imports of `GraphExecutionEngine`, `IrProgramGraph`, graph lowering, scenario runners
- Forbidden: handler tables, `_dispatch`, `_exec_body`, legacy `Executor`

Enforced by `runtime/architecture_guard.py` and `tests/test_architecture_boundary.py`.

## Production mode

```bash
export CICADA_GRAPH_NATIVE_MODE=1
export CICADA_RUNTIME_STRICT=1
```

All user-visible execution goes through **GraphExecutionEngine** → **NativeOps** → **native_core** → **IO**.

Legacy `Executor` is only **LegacyOracle** (parity tests).

## Module map (`native_core/`)

| Module | Role |
|--------|------|
| `base.py` | `NativeRuntime` facade |
| `conditions.py` | Expression evaluation |
| `messaging.py` | Outbound messages / keyboards / media |
| `storage.py` | DB, files, HTTP URL/body helpers |
| `async_actions.py` | HTTP methods, sleep, Telegram API, notify, broadcast |
| `flow_control.py` | Variables, log, loop signals |

## Related docs

- [ARCHITECTURE_FINAL.md](./ARCHITECTURE_FINAL.md)
- [NATIVE_OPS_REPORT.md](./NATIVE_OPS_REPORT.md)
