# GraphDocument Model

Canonical graph model for the Cicada Studio **constructor** (Graph Execution IDE). The canvas is a **projection**; all authoritative state lives in `GraphDocument`.

## Canonical model

`GraphDocument` (`src/constructor/graph_document/`) is the single source of truth:

| Field | Role |
|-------|------|
| `nodes` | Block nodes (id, type, position, data, meta) |
| `edges` | Structural connections (ports, label, condition) |
| `metadata` | Document name, revision, timestamps |
| `viewport` | Pan/zoom for the editor |
| `ui_state` | Selection, collapsed nodes, groups (non-semantic) |
| `schema_version` | Migration boundary |

Canvas/React state **must not** own nodes or edges as authoritative data. Use `projectGraphDocumentToCanvas(document)` for rendering.

## Operations as mutations

Every UI edit is an **operation** applied through `GraphEditorStore.dispatch()`:

- `AddNode`, `DeleteNode`, `MoveNode`
- `ConnectEdge`, `DisconnectEdge`
- `UpdateNodeData`, `UpdateCondition`
- `GroupSelection`

Forbidden in constructor UI (enforced by `graph_mutation_guard.js`):

- `setNodes` / `setEdges`
- `useNodesState` / `useEdgesState`
- Canvas-owned `authoritativeNodes` / `mutableGraph` state

```javascript
import { createGraphEditorStore, canvasEventToOperation } from '../constructor/index.js';

const store = createGraphEditorStore();
store.dispatch('AddNode', { nodeId: 'n1', type: 'start', position: { x: 40, y: 40 } });
const canvas = store.getCanvasProjection(); // read-only view for render
```

## Operation replay model (undo/redo)

History is an **append-only operation stream**, not snapshot-based undo:

- `applyOperation(history, op)` — append and apply
- `rollbackOperation(history)` — apply **inverse** of last op
- `redoOperation(history)` — re-apply from stream
- `replayOperations(seed, ops)` — deterministic rebuild (sync/collab)

Each `applyOperation` returns an `inverse` operation for rollback. Replaying the same stream from the same seed yields the same document (deterministic editing).

## Serialization

`GraphDocumentSerializer` (`graph_serializer.js`):

- `exportGraphDocument(doc)` — stable node/edge ordering, optional deterministic IDs
- `importGraphDocument(raw)` — parse + `migrateSchema()`
- `migrateSchema(doc, targetVersion)` — version upgrades

Operations in the stream are JSON-serializable (`id`, `type`, `payload`, `timestamp`, `actorId`, `baseRevision`) for future multiplayer merge via `mergeOperationStreams()`.

## Validation

`GraphDocumentValidator` — **structural only** (no execution semantics):

- Orphan nodes (no incident edges when graph size > 1)
- Invalid edges (missing endpoints, self-loops)
- Cycles (configurable via `allowCycles`)
- Schema / group consistency

## Canvas as projection

```
User gesture → canvasEventToOperation(event)
            → GraphEditorStore.dispatch(op)
            → GraphDocument (canonical)
            → projectGraphDocumentToCanvas(doc)
            → React render (derived, tagged __fromGraphProjection)
```

## Collaboration readiness

No WebSocket runtime yet. Architecture supports:

1. Export operation stream + document revision
2. `replayOperations` on peers after merge
3. `mergeOperationStreams(local, remote)` ordered by `timestamp` / `id`

Execution and trace layers remain outside this model (`EngineClient`, server runtime).

## Module map

| File | Role |
|------|------|
| `graph_document.js` | Canonical document factory |
| `graph_schema.js` | Schema version, normalization |
| `graph_operations.js` | `AddNode`, `ConnectEdge`, … + inverses |
| `graph_history.js` | Append-only stream, undo/redo, replay |
| `graph_serializer.js` | `exportGraphDocument`, `importGraphDocument`, `migrateSchema` |
| `graph_validator.js` | Structural validation only |
| `graph_projection.js` | Canvas projection + `canvasEventToOperation` |
| `graph_editor_store.js` | `GraphEditorStore.dispatch` |
| `graph_mutation_guard.js` | Forbid direct mutation |
| `stacks_bridge.js` | Legacy stacks ↔ GraphDocument |
| `useGraphEditor.js` | React hook |

## Deterministic editing

1. Same seed document + same operation stream ⇒ same `GraphDocument` (`replayOperations`).
2. `exportGraphDocument` uses stable sorted ids and deterministic remapping.
3. Operations carry `id`, `timestamp`, `actorId`, `baseRevision` for merge ordering.

## React integration

```javascript
import { useGraphEditor } from './constructor/index.js';

function Editor() {
  const { document, canvas, dispatchCanvasEvent, undo, redo } = useGraphEditor();
  // render canvas.nodes / canvas.edges (projection only)
  // on move: dispatchCanvasEvent({ kind: 'node_move', nodeId, position })
}
```

## Related docs

- [GRAPH_CONSTRUCTOR_ARCHITECTURE.md](./GRAPH_CONSTRUCTOR_ARCHITECTURE.md) — IDE layers and Graph IR
- [LAYER_SEPARATION_CONTRACT.md](./LAYER_SEPARATION_CONTRACT.md) — UI vs execution boundary
