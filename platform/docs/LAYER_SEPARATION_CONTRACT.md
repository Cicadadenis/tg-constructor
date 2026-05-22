# Layer Separation Contract

Immutable architectural boundary between **Execution**, **Trace**, and **Intelligence** planes.

## Three layers

```
EXECUTION LAYER  →  emits LEVEL_0 events
       ↓
TRACE LAYER      →  canonical ordered log (no interpretation)
       ↓
INTELLIGENCE     →  read-only derived projections
```

### Execution Layer (authoritative)

- `GraphExecutionEngine` / `GraphControlPlane`
- `GraphRouter`, `GraphTraversal`, `GraphResume`, `GraphScenarios`
- `NativeOps`, `native_core`
- **May** call `ExecutionTrace.emit()`
- **Must NOT** import compression, views, replay, overlay, or diff

**Allowlisted exception:** `GraphControlPlane.export_trace()` may lazy-import `debug.trace_export` only (export delegate, not execution).

### Trace Layer (canonical log)

- `runtime/trace.py` only
- `TraceEvent`, `TraceEventKind`, `ExecutionTrace.emit()`
- Passive `register_trace_observer` / `register_observability_bootstrap`
- **No** intelligence imports
- **No** control-plane / NativeOps imports
- **No** interpretation (`resume_chain` lives in intelligence)

### Intelligence Layer (derived only)

- `cicada_platform.debug.*`
- `TraceCompression`, `SmartTraceView`, `PerformanceOverlay`, diff, replay, inspector
- **Read-only** over `ExecutionTrace.events`
- **Must NOT** import control plane, NativeOps registry, or graph engine
- Replay **MUST** use LEVEL_0 events only (`REPLAY_LEVEL_0_ONLY`)

## Dependency direction

```
Execution  →  Trace  →  Intelligence
     ✗           ✗            ✗
     ←───────────┴────────────┘  (forbidden reverse deps)
```

| From | To | Allowed |
|------|-----|---------|
| Execution | Trace | emit, read own trace instance |
| Execution | Intelligence | **only** `trace_export` via `export_trace` |
| Trace | Intelligence | bootstrap callback registration only |
| Intelligence | Trace | read LEVEL_0 |
| Intelligence | Execution | **never** |

## Rules

1. **Execution does not know trace views** — no LEVEL_1/LEVEL_2, no compression in traversal.
2. **Trace does not affect execution semantics** — observers cannot change routing or NativeOps.
3. **Intelligence is a read-only projection system** — pure functions over canonical trace.
4. **LEVEL_0 is the only source of truth** — all derived layers are reproducible from `events`.
5. **Replay uses LEVEL_0 only** — never `CompressedTrace` or filtered views for step reconstruction.

## Enforcement

- `runtime/layer_separation_guard.py` — static import rules
- `tests/test_layer_separation.py` — CI guard
- `tests/conftest.py` — registers intelligence bootstrap for tests

## Related

- [EXECUTION_EQUIVALENCE_CONTRACT.md](./EXECUTION_EQUIVALENCE_CONTRACT.md)
- [SEMANTIC_MODEL_FINAL.md](./SEMANTIC_MODEL_FINAL.md)
- [TRACE_TRUTH_CONTRACT.md](./TRACE_TRUTH_CONTRACT.md)
- [ARCHITECTURE_LAYER_MODEL_FINAL.md](./ARCHITECTURE_LAYER_MODEL_FINAL.md)
- [EXECUTION_INTELLIGENCE_FINAL.md](./EXECUTION_INTELLIGENCE_FINAL.md)
