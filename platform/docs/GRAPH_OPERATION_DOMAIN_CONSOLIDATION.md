# Graph operation domain consolidation

The constructor graph uses a **single mutation language**: typed operations in `GRAPH_OPERATION_TYPES`, applied by `graph_operations.js` and recorded through `GraphEditorStore.dispatch`.

## Canonical layers

| Module | Role |
|--------|------|
| `graph_operations.js` | Pure `applyOperation` / inverses — the graph VM instruction set |
| `graph_ui_compositions.js` | Pure UI compiler → canonical operation specs (no dispatch) |
| `graph_operation_client.js` | Runtime `dispatch` + `applyComposition` runners |
| `graph_import.js` | Bootstrap op builders (`documentToBootstrapOperations`, …) |
| `graph_migration.js` | Load/migrate: clear + dispatch bootstrap op stream |
| `graph_stack_ops.js` | **Deprecated** — re-exports `graph_operation_client` only |

There is no second “stack mutation” domain. Stack drag, merge, and palette drop are **UI helpers** that compose:

- `AddNode`
- `RemoveNode`
- `MoveNode`
- `AddEdge`
- `UpdateNodeData`

(and other canonical types where needed, e.g. `UpdateViewport`).

`GraphOperations` in `graph_operation_client.js` is the named primitive dispatch surface (`removeNode`, `moveNode`, `addNode`, `addEdge`, `patchNodeData`, `setNodeData`).

## Elimination of dual semantics

Previously, `graph_stack_ops.js` looked like a parallel API (stack-level `moveStack`, `mergeStacks`, …). That file is now a **legacy adapter** with no unique logic.

Stack-oriented names remain for canvas ergonomics, but every call path reduces to granular operations on the event log. Undo/redo, replay, and collaboration all see the same stream.

## Import paths

- `migrateGraphDocument(graph, document)` → `documentToBootstrapOperations` → `dispatch` each op
- `migrateLegacyStacks(graph, stacks)` → `stacksToBootstrapOperations` → `dispatch` each op
- `importGraph` / `importStacks` on `graph_operation_client` are aliases of the above (deprecated names)

No separate “replace stacks” or snapshot mutation bypasses the operation engine.

## Deterministic operation stream

1. One successful `dispatch` = one canonical operation appended (with inverse).
2. Identical operation sequences yield identical `GraphDocument` state.
3. `replay(operations)` rebuilds from seed; bootstrap import is just a deterministic op list.

Tests: `platform/tests/test_operation_unification.js`, `platform/tests/test_granular_operations.js`, `platform/tests/test_single_mutation_model.js`.

## UI contract

`App.jsx` imports from `graph_operation_client.js`. Edits use `GraphOperations` compositions or `graph.dispatch` directly. `stacksView` is derived from `GraphDocument` (`graphDocumentToStacks`), not an authoritative parallel model.

## Related

- `platform/docs/GRAPH_SINGLE_MUTATION_MODEL.md` — store authority and forbidden APIs
- `platform/docs/GRAPH_GRANULAR_OPERATIONS_MODEL.md` — per-type operation reference
