# Trace Truth Contract

Normative rules for the **Execution Intelligence Layer** (`cicada_platform.debug`).

## Principles

1. **LEVEL_0 is canonical** — `ExecutionTrace.events` recorded at runtime is the sole source of truth.
2. **Intelligence is derived** — compression, views, overlay, diff, and replay never author execution outcomes.
3. **No second execution engine** — replay walks recorded events; it does not call NativeOps or mutate session state.

## Compression

| Rule | Requirement |
|------|-------------|
| C1 | `compress_trace` MUST NOT change execution semantics |
| C2 | Every compressed segment MUST retain full canonical event payloads in `segment.events` |
| C3 | `decompress_trace(compress(trace))` MUST equal `trace` (event-for-event) |
| C4 | Compression is presentation grouping only |

## Views (LEVEL_1, LEVEL_2)

| Rule | Requirement |
|------|-------------|
| V1 | All levels are **derived only** from LEVEL_0 |
| V2 | `SmartTraceView` is **read-only** — no mutation of trace, graph runtime state, or event order |
| V3 | Category filters (`CONDITIONS`, `OPS`, `ERRORS`) affect **exported view documents only** |
| V4 | Filters MUST NOT be used for replay integrity or contract tests |

## Replay integrity

| Rule | Requirement |
|------|-------------|
| R1 | `ReplayResult.steps` is the **canonical** step list (full fidelity to subset events) |
| R2 | Partial replay MUST equal `canonical_subset_events(trace, …)` in order and content |
| R3 | `skip_no_ops` affects `display_steps` only — NOT `steps`, `path_nodes`, or `edges` |
| R4 | `skip_no_ops` MUST NOT change logical replay state (path, edges, signatures) |
| R5 | Replay MUST NOT invoke NativeOps or produce side effects |

## Performance overlay

| Rule | Requirement |
|------|-------------|
| P1 | Overlay is **post-execution** annotation only |
| P2 | MUST NOT influence scheduling, ordering, or timing of real execution |
| P3 | Overlay data is never fed back into the control plane |

## Diff

| Rule | Requirement |
|------|-------------|
| D1 | `diff_traces` compares canonical LEVEL_0 signatures only |
| D2 | Diff output is advisory; it never alters traces |

## Verification

Enforced by `tests/test_trace_truth_contract.py` and `assert_lossless_roundtrip()`.

See also: [EXECUTION_INTELLIGENCE_FINAL.md](./EXECUTION_INTELLIGENCE_FINAL.md), [EXECUTION_DEBUGGING.md](./EXECUTION_DEBUGGING.md).
