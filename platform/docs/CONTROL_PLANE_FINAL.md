# Control Plane (Final)

The control plane is split into **sub-engines** wired by **`GraphControlPlane`** (facade).  
`GraphExecutionEngine` is a backward-compatible alias.

## Entry point

```
Inbound update
    → GraphControlPlane.handle_update()
        → GraphRouter
        → GraphTraversal / GraphScenarios / GraphResume
        → NativeOps → native_core → IO
```

## Layers

| Module | Responsibility | Must NOT |
|--------|----------------|----------|
| `graph_router.py` | Event → entry nodes, callbacks, messages, media, middleware hooks | Walk DAG / run ops |
| `graph_traversal.py` | Node/edge walk, If/loops, blocks, op dispatch | Resolve inbound routes |
| `graph_scenarios.py` | Scenario steps, subflows, `StartScenario` | Inbound routing |
| `graph_resume.py` | Suspend/resume, ask continuation, pending stmt lists | Graph walk / routing |
| `graph_scheduler.py` | Timers/delays boundary (Sleep/Timeout extension point) | Routing or traversal |
| `graph_control_plane.py` | Facade + wiring only | Mixed sub-engine logic |

## Dependency rule

```
graph_control_plane.py
    → graph_router, graph_traversal, graph_scenarios, graph_resume, graph_scheduler
        → protocol.py, context.py only (no sub-engine → sub-engine imports)
```

Sub-engines receive a **`ControlPlaneHost`** (the facade) for callbacks (`run_graph`, `scenarios`, `resume`).

## Invariants (CI)

- Each sub-engine file ≤ **300 lines** (`tests/test_control_plane_invariants.py`)
- No import cycles between sub-engines (only `graph_control_plane` imports all)

## Production flags

```bash
CICADA_GRAPH_NATIVE_MODE=1
CICADA_RUNTIME_STRICT=1
```

Execution semantics unchanged; parity tests must pass.

## Related

- [EXECUTION_SPEC.md](./EXECUTION_SPEC.md) — normative execution semantics
- [EXECUTION_MODEL_FINAL.md](./EXECUTION_MODEL_FINAL.md)
- [ARCHITECTURE_FINAL.md](./ARCHITECTURE_FINAL.md)
