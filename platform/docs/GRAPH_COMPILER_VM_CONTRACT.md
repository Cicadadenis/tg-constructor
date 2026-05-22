# Graph compiler ↔ VM contract

Strict separation between **UI compilation** and **mutation execution**. The UI cannot change runtime semantics except by emitting operations the VM already understands.

## Layers

| Layer | Module | Allowed | Forbidden |
|-------|--------|---------|-----------|
| **Compiler** | `graph_ui_compositions.js` | `compile*`, `compositionOp`, layout helpers | `dispatch`, `applyOperation`, store, VM imports |
| **Runtime client** | `graph_operation_client.js` | `applyComposition`, `dispatchOp` | compiler imports, `compile*` definitions |
| **Orchestrator** | `graph_ui_orchestrator.js` | wires `compile*` → `applyComposition` | only layer that imports compiler + client |
| **VM** | `graph_operations.js` | `applyOperation`, inverses, `createOperation` | UI imports, stack layout |

Contract definitions and validators live in **`graph_compiler_vm_contract.js`**.

## Compiler output shape

Every successful `compile*` returns:

```js
{ ok: true, operations: [{ type: 'MoveNode', payload: { … } }, …] }
```

Rules:

1. `type` ∈ `GRAPH_OPERATION_TYPES` (after alias normalization).
2. `payload` passes `validateCompositionOperationPayload(type, payload)`.
3. Full list passes `validateCompositionOperations()` / `validateCompiledComposition()`.

The compiler **never** mutates `GraphDocument` and **never** calls the VM.

## Runtime application

`applyComposition(graph, compiled)`:

1. `validateCompiledComposition(compiled)`
2. For each op: `graph.dispatch(type, payload)` → store → `applyOperation`

`dispatchValidatedOperations` is equivalent when ops are already validated.

Orchestration reads (`getGraphDocument` for merge edge ids, node data for UI attachments) happen **only** in the runtime client to supply compile inputs — not in the compiler.

## VM execution

`graph_operations.js` is the sole execution semantics layer:

- Deterministic `applyOperation(document, operation)`
- Inverse generation for undo/redo
- No knowledge of stacks, canvas, or React

## No semantic leakage rule

- UI layout decisions compile to coordinates and ids → `MoveNode` / `AddNode` / `AddEdge`.
- New behaviour requires a new **`GRAPH_OPERATION_TYPES`** entry in schema + VM — not a frontend-only API.
- `graph_stack_ops.js` is not part of the contract (deprecated re-export shim).

## Enforcement

| Mechanism | What it checks |
|-----------|----------------|
| `scanCompilerLayerSource` | No dispatch/VM imports in compiler |
| `scanRuntimeClientSource` | No `compile*` in runtime client |
| `scanSourceForHiddenCompositionDSL` | Non-canonical `dispatch('…')` in App/builder |
| `validateCompiledComposition` | Runtime gate before dispatch |

CI: `platform/tests/test_vm_compiler_separation.js`, `test_ui_composition_contract.js`, `test_ui_layer_guard.mjs`.

## Related

- `platform/docs/GRAPH_UI_COMPOSITION_CONTRACT.md`
- `platform/docs/GRAPH_OPERATION_FINAL_ARCHITECTURE.md`
