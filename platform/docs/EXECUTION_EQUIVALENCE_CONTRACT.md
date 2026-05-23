# Execution Equivalence Contract

Formal semantic equivalence between **Execution** (authority) and all **derived** layers.

## Authority model

| Layer | Semantic role |
|-------|----------------|
| **Execution** | Defines what actually ran — sole semantics authority |
| **Trace (LEVEL_0)** | Immutable record of execution facts |
| **Intelligence** | Pure projection space — non-authoritative |

## Core invariants

### E1 — Lossless projection

ALL derived representations MUST be **lossless projections** of LEVEL_0, or explicitly declared subsets (partial replay) with no invented events.

- `decompress(compress(trace)) ≡ trace` (event-for-event)
- `SmartTraceView` documents ⊆ facts inferable from `trace.events`
- Export fields are derived, never authoritative over LEVEL_0

### E2 — No semantic augmentation

Intelligence MUST NOT:

- Add nodes, edges, or transitions not present in LEVEL_0
- Infer alternate execution paths
- Rewrite op outcomes or branch results
- Promote annotations (overlay, summary) to facts

### E3 — No inferred execution paths

`flow`, `flow_narrative`, hot paths, and summaries are **narration**, not scheduling input. Traversal MUST NOT consume intelligence output.

### E4 — Replay equivalence

Full replay reconstructs LEVEL_0 step-for-step:

```
replay(trace).steps ≡ trace.events (order, kind, node_id, op)
```

Partial replay ≡ `canonical_subset_events(trace, …)` with no extra steps.

`skip_no_ops` affects `display_steps` only — not equivalence class.

### E5 — Diff preserves equivalence class

`diff_traces(a, b)` is read-only:

```
equivalence_signature(a) unchanged
equivalence_signature(b) unchanged
```

### E6 — Non-authoritative interpretation

No derived system may redefine execution semantics. If LEVEL_0 and a projection disagree, **LEVEL_0 wins**.

## Semantic Firewall

`runtime/semantic_firewall.py` enforces:

- `validate_level_0_integrity` — contiguous `seq`, valid kinds
- `validate_for_replay` — canonical `ExecutionTrace` only
- `validate_replay_steps_match_level_0` — post-replay check
- `validate_smart_trace_view` — no invented nodes/entries
- `validate_overlay_annotation_only` — overlay references ⊆ recorded nodes
- `validate_diff_preserves_inputs` — diff does not mutate traces

## Equivalence signature

```python
from cicada_platform.runtime.semantic_firewall import equivalence_signature
```

Stable tuple over `(kind, seq, node_id, op, detail)` used in tests to compare equivalence classes.

## Verification

```bash
pytest tests/test_execution_equivalence.py tests/test_trace_truth_contract.py -q
```

## Related

- [SEMANTIC_MODEL_FINAL.md](./SEMANTIC_MODEL_FINAL.md)
- [LAYER_SEPARATION_CONTRACT.md](./LAYER_SEPARATION_CONTRACT.md)
- [TRACE_TRUTH_CONTRACT.md](./TRACE_TRUTH_CONTRACT.md)
