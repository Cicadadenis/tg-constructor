# Graph Constructor Architecture

Graph Execution IDE: **authoring + visualization** without in-UI execution.

## Target model

```
UI (Graph Editor + Trace Viewer)
        │  Graph IR only
        ▼
External Engine API  →  GraphControlPlane + NativeOps + native_core
        │
        ▼
LEVEL_0 immutable trace  →  Intelligence (replay / diff / overlay, read-only)
```

## Layers

| Layer | Location | Role |
|-------|----------|------|
| **Builder UI** | `src/`, `src/builder/` | Canvas, blocks, DSL pane |
| **Constructor** | `src/constructor/` | Graph IR adapter, engine client, trace viewer |
| **Constructor (server)** | `platform/.../constructor/` | Structural validation only |
| **Execution** | `platform/.../runtime/` | Authoritative semantics |
| **Trace** | `runtime/trace.py` | LEVEL_0 log |
| **Intelligence** | `platform/.../debug/` | Projections |

## Builder rules (hard)

- Builder **does NOT** execute code
- Builder **does NOT** know NativeOps
- Builder **does NOT** contain runtime orchestration
- No `handle_update()` in UI
- No simulated runtime loops in UI

## GraphDocument (canonical editor model)

Authoritative constructor state lives in **GraphDocument** (`src/constructor/graph_document/`), not in canvas/React state.

See [GRAPH_DOCUMENT_MODEL.md](./GRAPH_DOCUMENT_MODEL.md) for the full operation-replay model.

- All edits: operation stream (`AddNode`, `ConnectEdge`, …) via `GraphEditorStore`
- Canvas: `projectGraphDocumentToCanvas` + `useGraphEditor` hook
- Undo/redo: inverse operations + replay (no snapshots)
- Canvas: `projectGraphDocumentToCanvas()` projection only

See [GRAPH_DOCUMENT_MODEL.md](./GRAPH_DOCUMENT_MODEL.md).

## Graph IR only mode

Constructor edits:

- nodes, edges, conditions, entry points (handlers / scenarios)

`GraphIRAdapter` (JS + Python):

- `create_node` / `update_node` / `delete_node`
- `create_edge`
- `validate_structure_only()` — schema + dangling edge checks **only**

## External execution

`EngineClient` (`src/constructor/engineClient.js`):

```javascript
import { defaultEngineClient } from './constructor/index.js';

const result = await defaultEngineClient.run(graphIR, { dsl, event });
const unsub = defaultEngineClient.subscribeTrace(result.trace_id, (payload) => { ... });
```

API:

- `POST /v1/constructor/graph/execute` — runs `GraphControlPlane` on server
- `GET /v1/constructor/trace/{trace_id}` — read-only LEVEL_0
- `POST /v1/constructor/graph/validate` — structural validation

## Trace view (read-only)

`traceViewer.js`:

- LEVEL_0 timeline
- replay index (UI scrubber, no execution)
- node highlight from enter/exit
- suspend/resume extraction
- performance overlay attachment (from `trace_export`, read-only)

**No mutation** of trace objects in UI (frozen copies).

## UI modes

| Mode | Purpose |
|------|---------|
| `AUTHORING` | Edit Graph IR |
| `DEBUG` | Trace replay + inspector via external engine |
| `ANALYTICS` | Performance + diff (read-only projections) |

Defined in `src/constructor/modes.js`.

## UI layer guard

`uiLayerGuard.js` + `tests/test_ui_layer_guard.mjs`:

- Forbid imports of `runtime/control_plane`, `NativeOps`, `GraphExecutionEngine`, etc.
- Allow `constructor/*`, `core/ir/*`, `core/graph/*`

## Debug preview migration

Legacy: `POST /api/bot/preview` (in-process executor).

New (opt-in): `VITE_USE_PLATFORM_ENGINE=1` → `runDebugExecution()` via `previewBridge.js`.

## Related docs

- [ARCHITECTURE_LAYER_MODEL_FINAL.md](./ARCHITECTURE_LAYER_MODEL_FINAL.md)
- [LAYER_SEPARATION_CONTRACT.md](./LAYER_SEPARATION_CONTRACT.md)
- [SEMANTIC_NAVIGATION_MODEL.md](./SEMANTIC_NAVIGATION_MODEL.md)

## Verification

```bash
pytest platform/tests/test_constructor_layer.py -q
node platform/tests/test_ui_layer_guard.mjs
```
