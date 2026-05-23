# Graph granular operations model

The constructor graph editor is **event-sourced**: `GraphDocument` evolves only through a stream of typed operations. There are no snapshot replacements during interactive editing.

## Snapshot vs operation model

| Approach | Behavior | Used for |
|----------|----------|----------|
| **Snapshot replace** | Replace entire `GraphDocument` in one step | Migration import only (`importStacks` / `replay`) |
| **Granular operations** | `AddNode`, `MoveNode`, `RemoveNode`, … with inverses | All runtime UI edits |

`ReplaceGraphDocument` was removed from the runtime operation set. Bulk load rebuilds state by **replaying** a list of granular bootstrap operations derived from imported stacks or a document blob.

## Runtime operation set

- `AddNode` / `RemoveNode`
- `MoveNode`
- `UpdateNodeData` (includes optional `meta` patch, e.g. `uiAttachments`)
- `AddEdge` / `RemoveEdge`
- `UpdateEdge` (condition, label, ports)
- `UpdateViewport`
- `GroupSelection` (UI grouping)

Legacy names (`DeleteNode`, `ConnectEdge`, …) are normalized to the canonical types in `graph_operations.js`.

## Undo / redo

Every successful operation records an **inverse operation** on the history stack. Undo applies inverses; redo reapplies originals. No snapshot fallback.

Stack-level UI helpers in `graph_operation_client.js` compose multiple granular dispatches (e.g. move all nodes in a stack on drag end). `graph_stack_ops.js` re-exports them for legacy imports only.

## Import / migration boundary

- `graph_import.js` — `documentToBootstrapOperations`, `importStacksIntoStore`
- `stacks_dispatch_payload.js` — deprecated; do not use in App
- App: `graph.importStacks(...)`, `graph.importGraph(...)` for load/save/DSL/project import only

Interactive handlers use `removeNode`, `patchNodeData`, `moveStack`, `addBlockToStack`, `mergeStacks`, etc.

## Collaboration readiness

Granular ops provide:

- Deterministic replay from an empty seed
- Fine-grained revision history
- Mergeable operation streams (`mergeOperationStreams`)

## Related

- `platform/docs/GRAPH_SINGLE_MUTATION_MODEL.md` — dispatch-only contract
- `platform/tests/test_granular_operations.js` — CI enforcement
