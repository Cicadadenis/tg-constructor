# Execution Intelligence Layer (Final)

## Separation of concerns

```
┌─────────────────────────────────────────────────────────┐
│  Execution Layer (authoritative)                        │
│  GraphControlPlane → traversal → NativeOps → effects    │
│  Emits LEVEL_0 ExecutionTrace at runtime                │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼ immutable trace
┌─────────────────────────────────────────────────────────┐
│  Intelligence Layer (non-semantic, derived only)        │
│  compress / decompress / SmartTraceView / overlay       │
│  diff / replay (observability) / TraceInspector         │
└─────────────────────────────────────────────────────────┘
```

The intelligence layer **never** becomes a second execution engine.

## Source of truth

| Artifact | Role |
|----------|------|
| `ExecutionTrace.events` (LEVEL_0) | Canonical, immutable contract surface |
| `CompressedTrace` | Lossless grouping; `decompress_trace` restores LEVEL_0 |
| LEVEL_1 / LEVEL_2 views | Human-scale projections |
| `ReplayResult.steps` | Canonical replay walk |
| `ReplayResult.display_steps` | UI-only; optional Noop filtering |

## Modules

| Module | Responsibility |
|--------|----------------|
| `trace_compression.py` | Lossless compress / decompress |
| `trace_truth.py` | Equality + roundtrip asserts |
| `trace_view.py` | Read-only SmartTraceView |
| `trace_levels.py` | LEVEL_0 / 1 / 2 |
| `performance_overlay.py` | Post-exec hot path / slow branch hints |
| `trace_diff.py` | A/B comparison |
| `replay.py` | Observability replay (no NativeOps) |
| `replay_integrity.py` | Canonical subset helpers |
| `trace_inspector.py` | Facade for tooling |

## Trace Truth Contract

Normative rules: [TRACE_TRUTH_CONTRACT.md](./TRACE_TRUTH_CONTRACT.md).

Key guarantees:

- Compression does not change semantics.
- Views and filters do not affect replay correctness.
- Original trace (LEVEL_0) is canonical.
- Intelligence is derived, never authoritative.

## Environment flags

Intelligence consumes traces produced when:

- `CICADA_EXEC_TRACE_MODE=1`
- `CICADA_EXEC_REPLAY_MODE=1`
- `CICADA_EXEC_PROFILE_MODE=1`

Flags enable recording/observers only; they do not move logic into the debug package.

## Tooling entry points

```python
from cicada_platform.debug import (
    TraceInspector,
    TraceLevel,
    compress_trace,
    decompress_trace,
    assert_lossless_roundtrip,
)

assert_lossless_roundtrip(engine.trace)
insp = TraceInspector(engine.graph, engine.trace)
insp.smart_view(TraceLevel.LEVEL_1)
```

## Boundaries (hard)

- No changes to `GraphExecutionEngine` / control-plane semantics for intelligence features.
- No changes to NativeOps registry or execution paths.
- No feeding overlay or compressed views back into traversal or resume.

## Layer separation

Immutable boundaries: [LAYER_SEPARATION_CONTRACT.md](./LAYER_SEPARATION_CONTRACT.md).

Full model: [ARCHITECTURE_LAYER_MODEL_FINAL.md](./ARCHITECTURE_LAYER_MODEL_FINAL.md).

## Related docs

- [EXECUTION_SPEC.md](./EXECUTION_SPEC.md) — runtime contract
- [EXECUTION_DEBUGGING.md](./EXECUTION_DEBUGGING.md) — operator workflow
- [TRACE_TRUTH_CONTRACT.md](./TRACE_TRUTH_CONTRACT.md) — normative truth rules
