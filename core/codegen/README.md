# Cicada aiogram 3 codegen

**Единственный execution target** для preview и экспорта бота.

## Pipeline

```
Graph JSON (Flow)
  → normalizeGraphFlow / graphToNormalizedAst
  → assertValidAst (registry must cover every node type)
  → flowToStacks → buildPythonModule
  → validatePythonSyntax (py_compile)
  → bot.py
```

## Layout

| Module | Role |
|--------|------|
| `registry.js` | `registerCompiler(type, fn)` |
| `pipeline.js` | `compileGraphToPython()` |
| `compileCore.js` | Block compilers + handler tree + module assembly |
| `moduleCompiler.js` | `compileBot()`, `compileCommands()`, `compileMain()` |
| `handlerCompiler.js` | Handler tree exports |
| `blockCompilers/registerAll.js` | Registers all block types |
| `ast/normalize.js` | Normalized node schema `{ id, type, payload, children, edges }` |
| `ast/validate.js` | Missing compiler → `AstValidationError` |
| `keyboards.js` / `filters.js` / `media.js` | Themed re-exports |

## UI

- Preview: `src/constructor/previewCodegenBridge.js` → `compileErrors` in snapshot
- Palette: `GRAPH_OPERATION_TYPES` + `GRAPH_UI_OPERATION_METADATA` + `GRAPH_UI_NODE_METADATA`

Legacy DSL (`dslCodegen.js`, `cic-st-core`) is **not** used for constructor preview.
