# Graph UI composition contract

The constructor frontend has **two layers** with a strict boundary:

| Layer | Module | Role |
|-------|--------|------|
| **Mutation VM** | `graph_operations.js`, `GraphEditorStore.dispatch` | Sole runtime mutation language (`GRAPH_OPERATION_TYPES`) |
| **UI compiler** | `graph_ui_compositions.js` | Pure compile utilities → frozen `{ type, payload }` specs |

UI composition **≠** domain mutation.

## Rules

1. **No new operation types** in UI code. Only types listed in `GRAPH_OPERATION_TYPES` may reach `dispatch`.
2. **Stack/canvas helpers** (`moveStack`, `mergeStacks`, `appendStacks`, …) must:
   - compile via `compile*` functions in `graph_ui_compositions.js`
   - apply via `applyComposition` in `graph_operation_client.js`
3. **`graph_ui_compositions.js`** must not call `dispatch`, touch `GraphEditorStore`, or read live document state (except via explicit compile inputs).
4. **`graph_stack_ops.js`** is deprecated re-export only — not used at runtime for semantics.
5. **Import/migration** uses `graph_migration.js` bootstrap streams (also canonical ops only).

## Compiler API

Validators and layer markers: **`graph_compiler_vm_contract.js`** (`COMPILER_LAYER`, `validateCompiledComposition`, `scanCompilerLayerSource`). Full boundary spec: **`GRAPH_COMPILER_VM_CONTRACT.md`**.

- `compositionOp(type, payload)` — build one validated spec
- `validateCompositionOperations(ops)` — assert all types are canonical
- `compileMoveStack`, `compileAddBlockToStack`, `compileAppendStacks`, `compileMergeStacks`, … — layout compilers
- `applyComposition(graph, compiled)` — runtime runner (client only)

## Enforcement

- `graph_composition_guard.js` — detects forbidden DSL literals and non-canonical `dispatch('…')` in UI sources
- `uiLayerGuard.findForbiddenImportsInSource` — includes composition guard scans
- CI: `platform/tests/test_ui_composition_contract.js`, `platform/tests/test_ui_layer_guard.mjs`

## Anti-patterns (forbidden)

- `dispatch('ReplaceGraphDocument', …)` or any type not in `GRAPH_OPERATION_TYPES`
- `export function mutateGraph…` / `replaceStacks…` in builder or App
- Stack mutation logic in `graph_stack_ops.js` or duplicate semantics outside compile path

## Related

- `platform/docs/GRAPH_OPERATION_FINAL_ARCHITECTURE.md`
- `platform/docs/GRAPH_OPERATION_DOMAIN_CONSOLIDATION.md`
