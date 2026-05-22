# Graph semantic firewall — strict mode

Formal isolation between **Compiler**, **Runtime Client**, **Orchestrator**, and **VM**. `STRICT_VM_SEMANTICS_MODE = true` is always on in `graph_compiler_vm_contract.js`.

## Layer isolation model

```
┌─────────────────────┐
│ graph_ui_compositions │  compile* → [{ type, payload }]
└──────────┬──────────┘
           │ IR only
┌──────────▼──────────┐
│ graph_ui_orchestrator │  only module that imports compiler + client
└──────────┬──────────┘
           │ validateCompiledComposition → dispatch
┌──────────▼──────────┐
│ graph_operation_client │  applyComposition, dispatchOp (no compiler import)
└──────────┬──────────┘
           │ canonical ops
┌──────────▼──────────┐
│ graph_operations      │  applyOperation (no UI imports)
└─────────────────────┘
```

Neutral contract module: `graph_compiler_vm_contract.js` (schema validation + static rules only).

## Forbidden dependency graph

| From layer | Must NOT import |
|------------|-----------------|
| Compiler (`graph_ui_compositions.js`) | VM, runtime client, orchestrator, store, history |
| Runtime client (`graph_operation_client.js`) | Compiler, orchestrator |
| VM (`graph_operations.js`) | Compiler, runtime client, orchestrator |
| Orchestrator (`graph_ui_orchestrator.js`) | May import compiler + client only |

Indirect chains (e.g. compiler → contract → … → VM) are blocked by explicit import scans and `analyzeLayerDependencyGraph`.

## Semantic leakage attack vectors (blocked)

| Vector | Enforcement |
|--------|-------------|
| Direct `dispatch` in compiler | `COMPILER_FORBIDDEN_PATTERNS` |
| Runtime client imports `compile*` | `RUNTIME_CLIENT_FORBIDDEN_IMPORTS` |
| VM imports UI orchestration | `VM_FORBIDDEN_IMPORTS` |
| `export { applyOperation } from './graph_operations'` | `REEXPORT_BYPASS_PATTERNS` |
| `import { applyOperation as run }` | `ALIAS_LEAKAGE_PATTERNS` |
| Dynamic `import()` / `eval` / `Reflect` in compiler or client | forbidden patterns |
| Non-canonical op types | `STRICT_VM_SEMANTICS_MODE` + `validateStrictDispatch` |
| Malformed payloads | strict payload rules + unknown key rejection |
| Bypass validation in `applyComposition` | always calls `validateCompiledComposition` first |

## Strict semantics guarantees

When `STRICT_VM_SEMANTICS_MODE` is true:

1. Every op type ∈ `GRAPH_OPERATION_TYPES` (aliases normalized).
2. Payloads satisfy per-type rules (`STRICT_PAYLOAD_RULES`).
3. Unknown payload keys rejected before dispatch.
4. `applyComposition` refuses invalid IR without touching the store.
5. `dispatchOp` runs `validateStrictDispatch` on every primitive dispatch.

## Application usage

- **App / UI**: import runners from `graph_ui_orchestrator.js` (`moveStack`, `appendStacks`, …).
- **Low-level apply**: `applyComposition` from `graph_operation_client.js` with compiler-produced IR.
- **Never**: import `graph_ui_compositions` from App for dispatch; compile then pass IR to orchestrator/client.

## CI

- `platform/tests/test_semantic_firewall_strict.js`
- `platform/tests/test_vm_compiler_separation.js`
- `platform/tests/test_ui_composition_contract.js`
- `platform/tests/test_ui_layer_guard.mjs`

## Related

- `platform/docs/GRAPH_COMPILER_VM_CONTRACT.md`
- `platform/docs/GRAPH_OPERATION_FINAL_ARCHITECTURE.md`
