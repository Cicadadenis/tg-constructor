# Graph single mutation model

The constructor UI treats **GraphDocument** as the sole runtime source of truth. All runtime edits flow through a single write API.

## Authority

| Layer | Role |
|-------|------|
| `GraphDocument` | Canonical graph state (nodes, edges, viewport, ui_state, metadata) |
| Operation log | Ordered history with inverses for undo/redo |
| Canvas projection | Read-only view (`getCanvasProjection`) |
| Legacy stacks | **Migration only** — `stacks_bridge` + `graph_migration.js` at load/import |

There is no parallel stacks React state. Layout reads derive from `graphDocumentToStacks(getGraphDocument())` for stack-shaped rendering until the canvas is fully projection-native.

## Public UI API (`useGraphEditor`)

Only these methods are exposed to React UI:

```js
const graph = useGraphEditor();

graph.getGraphDocument();
graph.getCanvasProjection();
graph.dispatch('AddNode', { nodeId, type, position, data });
graph.setViewport({ x, y, zoom }); // → UpdateViewport
graph.undo();
graph.redo();
```

No `mutateStacks`, `replaceStacks`, `replaceDocument`, `importStacks`, `importGraph`, or `store.replay`.

## Runtime edits

Stack-shaped gestures **compile** in `graph_ui_compositions.js` and **apply** via `graph_operation_client.js` (`applyComposition`):

- `addBlockToStack` → `AddNode` + `AddEdge`
- `moveStack` → multiple `MoveNode`
- `clearGraph` → `RemoveNode` per node
- `mergeStacks` → `AddEdge` + `MoveNode`

Each helper calls `graph.dispatch` only.

## Migration (one-time / load)

`graph_migration.js` (not on the hook):

- `migrateGraphDocument(graph, document)` — clear + bootstrap `dispatch` replay
- `migrateLegacyStacks(graph, stacks)` — stacks JSON → bootstrap ops → `dispatch`

Used from `App.jsx` for autosave, project open, and examples — not for interactive editing.

## Deterministic evolution

1. Each `dispatch` applies one `GRAPH_OPERATION_TYPES` operation.
2. Successful applies append to the stream with an inverse.
3. `undo` / `redo` walk the cursor over that stream.

Identical operation sequences yield identical documents.

## Enforcement

`graph_mutation_guard` / `uiLayerGuard` reject:

- React Flow direct state (`setNodes`, `useNodesState`, …)
- Legacy hook APIs (`mutateStacks`, `replaceStacks`, `graph.importStacks`, …)
- `store.replay` / `replaceDocument` on the editor store

Tests:

- `platform/tests/test_single_mutation_model.js`
- `src/constructor/graph_ui.test.js`

## Related

- [GRAPH_DOCUMENT_MODEL.md](./GRAPH_DOCUMENT_MODEL.md)
- [GRAPH_UI_MIGRATION.md](./GRAPH_UI_MIGRATION.md)
