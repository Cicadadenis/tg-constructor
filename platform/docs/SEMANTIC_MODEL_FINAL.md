# Semantic Model (Final)

Cicada Platform as a **formally deterministic execution engine** with **non-divergent observability**.

## Three semantic roles

### Execution = semantics authority

- `GraphControlPlane` + `GraphTraversal` + `NativeOps` decide routing, effects, suspend/resume.
- Only this plane can change bot/session state and emit side effects.
- **Defines** the equivalence class of a run.

### Trace = immutable record

- `ExecutionTrace.events` (LEVEL_0) is the audit log.
- Append-only during `handle_update`; structural integrity enforced by semantic firewall.
- **Records** the equivalence class; does not interpret it.

### Intelligence = pure projection space

- Compression, views, overlay, diff, replay tooling.
- Functions of LEVEL_0 only (read-only, non-authoritative).
- **Projects** the equivalence class for humans and CI; never replaces it.

## Equivalence invariants

| ID | Invariant |
|----|-----------|
| EQ-1 | `equivalence_signature(trace)` is stable for a fixed run |
| EQ-2 | `compress → decompress` preserves signature |
| EQ-3 | Full `replay` preserves signature |
| EQ-4 | Partial replay matches declared LEVEL_0 subset |
| EQ-5 | `diff` does not mutate inputs |
| EQ-6 | Views/overlays reference only nodes/events in LEVEL_0 |

## Dependency + semantics

```
Execution ──defines──▶ semantics
        ──emit──▶ LEVEL_0 trace
                        │
                        ▼ (lossless / subset projections)
                  Intelligence
```

**Forbidden:** intelligence → execution feedback (scheduling, traversal, NativeOps).

## Semantic Firewall

Located in `runtime/semantic_firewall.py` (runtime plane, callable from intelligence).

Validates:

1. Trace integrity before replay
2. Replay steps vs LEVEL_0 after replay
3. SmartTraceView documents (no invented graph elements)
4. Performance overlay (annotations only)
5. Diff read-only property

## What “equivalent” means

Two traces are in the **same equivalence class** iff their LEVEL_0 signatures match event-for-event.

Derived artifacts are equivalent to a run iff they can be reconstructed from that run’s LEVEL_0 without loss (or are explicit subsets for partial replay).

## Semantic navigation

Intent-based story over LEVEL_0 (non-authoritative): [SEMANTIC_NAVIGATION_MODEL.md](./SEMANTIC_NAVIGATION_MODEL.md).

## Contracts stack

1. [EXECUTION_SPEC.md](./EXECUTION_SPEC.md) — runtime behavior
2. [LAYER_SEPARATION_CONTRACT.md](./LAYER_SEPARATION_CONTRACT.md) — import boundaries
3. [TRACE_TRUTH_CONTRACT.md](./TRACE_TRUTH_CONTRACT.md) — lossless compression
4. [EXECUTION_EQUIVALENCE_CONTRACT.md](./EXECUTION_EQUIVALENCE_CONTRACT.md) — semantic equivalence

## CI gates

```bash
pytest tests/test_execution_equivalence.py
pytest tests/test_layer_separation.py
pytest tests/test_trace_truth_contract.py
```

All must pass for merge — observability cannot diverge from execution facts.
