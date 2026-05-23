# Graph operation final architecture

## Single mutation language

Runtime graph state changes only through **`GRAPH_OPERATION_TYPES`** applied by `graph_operations.js` and recorded on `GraphEditorStore`.

There is exactly one mutation VM. No parallel stack language, no snapshot replace, no hidden frontend DSL.

```
┌─────────────────────────────────────────────────────────┐
│  UI (App.jsx, canvas handlers)                          │
│    compile*()  →  [{ type, payload }, …]                │
│    applyComposition(graph, compiled)                    │
└──────────────────────────┬──────────────────────────────┘
                           │ dispatch(canonical)
┌──────────────────────────▼──────────────────────────────┐
│  GraphEditorStore + graph_operations (VM)               │
│    AddNode | RemoveNode | MoveNode | AddEdge | …        │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  GraphDocument (canonical state)                        │
│    → projection → canvas view                           │
└─────────────────────────────────────────────────────────┘
```

## UI composition layer as compiler

`graph_ui_compositions.js` is a **pure compiler**:

- Input: stacks layout, node ids, coordinates, optional `existingEdgeIds` for merge
- Output: frozen operation specs
- No dispatch, no store, no new semantics

`graph_operation_client.js` is the **runtime adapter**:

- `GraphOperations` — primitive `dispatch` wrappers
- `applyComposition` — validated multi-op runner
- Stack-named functions — `compile*` + `applyComposition` only

This split eliminates **domain drift**: UI cannot accidentally grow a second mutation language.

## Strict VM boundary

| Inside VM | Outside VM (compiler only) |
|-----------|----------------------------|
| `applyOperation` | `compileMoveStack` |
| Inverses / undo | `blockPositionInStack` |
| `GRAPH_OPERATION_TYPES` | `findStack`, `blockToNodePayload` |

Load/migrate path: `graph_import` builds bootstrap ops → `graph_migration.replayBootstrapOperations` dispatches each op (same VM).

## Deprecated / excluded from runtime semantics

- `graph_stack_ops.js` — re-export shim only
- `importGraph` / `importStacks` aliases — prefer `migrateGraphDocument` / `migrateLegacyStacks`

## Enforcement and tests

- `graph_composition_guard.js` + `uiLayerGuard.js` — hidden DSL detection
- `platform/tests/test_ui_composition_contract.js` — compile ≡ apply, canonical types only
- `platform/tests/test_operation_unification.js` — legacy adapter + migration equivalence

## Domain drift elimination checklist

- [x] One `GRAPH_OPERATION_TYPES` enum
- [x] UI helpers compile before dispatch
- [x] No logic in `graph_stack_ops.js`
- [x] CI guards for non-canonical dispatch literals
- [x] Documented contract: `GRAPH_UI_COMPOSITION_CONTRACT.md`, `GRAPH_COMPILER_VM_CONTRACT.md`, `GRAPH_SEMANTIC_FIREWALL_STRICT_MODE.md`
