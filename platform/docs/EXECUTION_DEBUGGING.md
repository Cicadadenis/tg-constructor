# Execution Debugging & Observability

Observability sits **above** the Execution Spec: it records and replays traces without changing control-plane semantics or NativeOps.

## Environment flags

| Variable | Purpose |
|----------|---------|
| `CICADA_EXEC_TRACE_MODE=1` | Full trace on `GraphControlPlane.last_execution_trace` |
| `CICADA_EXEC_REPLAY_MODE=1` | Enable trace store + offline replay helpers |
| `CICADA_EXEC_PROFILE_MODE=1` | Per-node `profile_duration_ms` in trace detail (hooks) |

Flags compose: trace mode exports; replay/profile install observers on first `trace.emit`.

## Trace model

Each `handle_update` gets a fresh `trace_id`. Events are ordered (`seq`), reconstructable:

- `execution_start` / `execution_end`
- `node_enter` / `node_exit`
- `transition_taken`, `condition_evaluated`, `action_executed`
- `suspend` / `resume` (cross-turn resume uses session state; chain is in trace)

## Trace Export API

```python
doc = engine.export_trace()  # current trace
doc = engine.export_trace(trace_id)  # from TraceStore after trace/replay mode
```

Document sections:

- `nodes_timeline` — enter/exit/action per node
- `edges_taken` — transitions and conditions
- `resume_events` — suspend → resume chain
- `suspended_states` — waiting_for snapshots
- `profiler` — node/op timings, slow nodes

## Execution Trace Inspector

`platform/src/cicada_platform/debug/trace_inspector.py`:

```python
from cicada_platform.debug import TraceInspector

inspector = TraceInspector(engine.graph, engine.trace)
print(inspector.render_text())
inspector.inspect_node(node_id)
inspector.replay_step_by_step()
inspector.resume_chain_visualization()
inspector.slow_nodes(threshold_ms=5.0)
```

## Replay model

`CICADA_EXEC_REPLAY_MODE=1` registers traces in `TraceStore` at `execution_end`.

Offline replay (`debug/replay.py`) walks recorded events only:

- No `NativeOpRegistry.execute`
- No transport / effects
- Deterministic path reconstruction

```python
from cicada_platform.debug.replay import replay_trace

result = replay_trace(graph, trace)
assert result.side_effects is False
```

Use replay to validate trace contract, diff runs, or power step-by-step UI.

## Debug hooks (non-invasive)

Register on `HookRegistry` via `register_hooks` or append to lists:

- `on_node_enter`
- `on_node_exit`
- `on_suspend`
- `on_resume`

Hooks run from trace observers after events are appended; they must not mutate execution state.

## Execution Profiler

Derived from trace timestamps (`NODE_ENTER` / `NODE_EXIT`):

- Time per node and per op
- Slow node list (configurable threshold)

Also available in `export_trace()` → `profiler` and `TraceInspector.slow_nodes()`.

## Trace levels & compression

Analysis is **derived** from raw traces — runtime semantics unchanged.

| Level | Mode | Use |
|-------|------|-----|
| `LEVEL_0` | Full raw events | Contract tests, deep dives |
| `LEVEL_1` | Condensed flow (compressed segments) | Large traces, replay UI |
| `LEVEL_2` | Human execution summary | Ops dashboards |

```python
from cicada_platform.debug import TraceInspector, TraceLevel, TraceCategoryFilter

insp = TraceInspector(graph, trace)
insp.smart_view(TraceLevel.LEVEL_1)
insp.render(TraceLevel.LEVEL_2)
insp.smart_view(TraceLevel.LEVEL_0, category=TraceCategoryFilter.CONDITIONS)
```

`trace_compression.py`:

- Collapse repeated enter/exit on same node
- Group identical loop transitions
- Aggregate duplicate transitions/conditions
- `filter_replay_steps(skip_no_ops=True)` drops `Noop` noise

## Performance overlay

```python
overlay = insp.performance_overlay()
overlay.summary()  # hot_paths, slow_branches, bottlenecks_by_op
```

LEVEL_1 views annotate segments with `HOT` / `SLOW` flags.

## A/B trace diff

```python
diff = insp.diff(other_trace)
diff.summary()  # path_only_a/b, signature_delta
```

## Partial replay

```python
replay_trace(graph, trace, node_ids={"n1", "n2"}, skip_no_ops=True)
insp.replay_partial({"n1", "n2"})
```

Subgraph replay filters events by `node_id` / transition targets; still no NativeOps or side effects.

## Debugging workflow

1. Enable `CICADA_EXEC_TRACE_MODE=1` (and optionally `PROFILE` / `REPLAY`).
2. Run bot scenario; capture `trace_id` from `engine.trace.trace_id` or `last_execution_trace`.
3. `export_trace(trace_id)` or `TraceInspector` for timeline and resume chain.
4. For regressions: compare `export_trace()` documents or `_trace_signature` tuples on the **same compiled graph**.
5. For suspend bugs: inspect `resume_events` and `suspended_states`.
6. For perf: `profiler.slow_nodes` or `CICADA_EXEC_PROFILE_MODE=1`.
7. For safe re-walk: `replay_trace(graph, stored_trace)` without re-executing ops.

## Boundaries

- Control plane traversal and NativeOps are unchanged.
- Observability hooks via `runtime/trace.py` observers + `debug/` package only.
- `GraphControlPlane.export_trace` is a thin export delegate.

## Trace Truth Contract

Normative non-semantic rules: [TRACE_TRUTH_CONTRACT.md](./TRACE_TRUTH_CONTRACT.md).

Architecture summary: [EXECUTION_INTELLIGENCE_FINAL.md](./EXECUTION_INTELLIGENCE_FINAL.md).

See also: [EXECUTION_SPEC.md](./EXECUTION_SPEC.md).
