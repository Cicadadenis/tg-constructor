# Graph UI Migration

Migration of the Cicada Studio builder from **legacy stacks React state** to **GraphDocument + GraphEditorStore**.

## Old vs new model

| Legacy | GraphDocument |
|--------|----------------|
| `useState(stacks)` / `setStacks` | `useGraphEditorStore()` |
| Canvas owned block positions | `GraphDocument.nodes[].position` + `viewport` |
| Implicit vertical chains in stacks | Explicit `edges` + `meta.stackId` for stack layout |
| In-UI `/api/bot/preview` executor | `runDebugExecution` → `engineClient.run()` only |
| Snapshot undo (none) | Operation log + inverse replay |

## Store-based architecture

```javascript
const graph = useGraphEditor();
const stacks = graph.stacksView; // derived at render — NOT authoritative

graph.dispatch('AddNode', { nodeId, type, position, data });
graph.undo();
graph.redo();
graph.getGraphDocument();
graph.getCanvasProjection();
```

All persistence:

- Local: `persistCanvasBlob(getGraphDocument())` via `saveCanvasForKey`
- Cloud projects: `graphDocumentToStacks(getGraphDocument())` until API stores GraphDocument natively
- Legacy load: `loadPersistedCanvasBlob` → `graph.dispatch('ReplaceGraphDocument', …)` (stacks migrated once)

## Projection rendering

```
GraphDocument → projectGraphDocumentToCanvas() → GraphCanvas (stateless)
```

`GraphCanvas` (`src/builder/GraphCanvas.jsx`):

- Accepts `projection` with `__fromGraphProjection` marker
- Accepts derived `stacksView` for existing `BlockStack` layout
- Emits events upward; parent calls `graph.dispatch` only

**No** `setNodes` / `setEdges` / React Flow state.

## Debug / trace mode

Preview chat uses **external engine only**:

1. `generateDslFromGraphDocument(graph.getGraphDocument())`
2. `runDebugExecution({ dsl, text, callbackData })`
3. `DebugTracePanel` subscribes to LEVEL_0 trace (read-only highlights)

Removed: in-UI DSL preview runtime (`/api/bot/preview` path).

## Temporary bridge

- `stacks_bridge.js` — `stacksToGraphDocument` / `graphDocumentToStacks` (via `core/graph`)
- `persist_bridge.js` — `loadPersistedCanvasBlob` / `persistCanvasBlob` (legacy stacks once on load)
- `@deprecated` — remove when DB/API store GraphDocument only

## Enforcement

`uiLayerGuard` scans for forbidden `setNodes` / `setEdges` patterns in constructor sources.

## Related

- [GRAPH_DOCUMENT_MODEL.md](./GRAPH_DOCUMENT_MODEL.md)
- [GRAPH_CONSTRUCTOR_ARCHITECTURE.md](./GRAPH_CONSTRUCTOR_ARCHITECTURE.md)
