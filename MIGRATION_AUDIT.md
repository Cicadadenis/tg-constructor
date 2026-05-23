# Migration Audit — DSL/Cicada → Graph + aiogram 3

## Migration status matrix

| Component | Target state | Actual state | Grade |
|-----------|--------------|--------------|-------|
| `cic-st-core/` | Removed | **Absent** (guard forbidden) | ✅ |
| `.ccd` sources | Archived/removed | **0 files** in repo | ✅ |
| `core/dslCodegen.js` | Removed | Guard forbidden | ✅ |
| Studio preview/export | Python aiogram 3 | `core/codegen` + `previewCodegenBridge` | ✅ |
| Bot run | Python subprocess | `services/dslRunner.mjs` | ✅ (name legacy) |
| React Flow editor | Graph stacks UI | **Stacks canvas**; RF node type `cicada` wrapper only | ⚠️ |
| Platform compiler | IR/graph | `parse_dsl` **raises** | ❌ |
| Platform execute | Graph engine | `constructor.py` still calls `parse_dsl` | ❌ |
| Parity tests | Graph oracle | `LegacyOracle` needs external core | ❌ |
| Docs/README | Python-first | Many references to `cic-st-core`, `.ccd` | ❌ |
| AI prompts | Graph JSON only | `server.mjs` forbids DSL; `llmOutput.js` still .ccd-aware | ⚠️ |

## Removed (confirmed)

- Directory `cic-st-core/`
- `generateDslFromProjectGraph()` — throws in `core/graph/runtime.js`
- `src/ccdParser.js`, `core/dslCodegen.js` (guard)
- Example `.ccd` files (graphs in `src/examples/flows/*.js`)

## Renamed / misleading (not removed)

| File | Reality |
|------|---------|
| `core/stacksToDsl.js` | Python codegen barrel |
| `services/dslRunner.mjs` | Python bot runner |
| `node.type === 'cicada'` | Canvas envelope; block in `data.type` |
| `core/legacyDslWarn.js` | Unused warn helper |

## Split-brain zones

1. **Studio (Node)** — production-ready Graph → Python.
2. **Platform (Python)** — graph types exist (`IrProgramGraph`, `GraphExecutionEngine`) but entrypoints still import DSL bridge.
3. **Tests** — mix of passing aiogram3 tests and DSL-dependent platform tests.

## Examples system migration

| Check | Status |
|-------|--------|
| `EXAMPLE_GRAPH_FLOWS` registry | ✅ 9 keys |
| Rules + codegen CI | ✅ `examples-library.test.mjs` |
| UI load path | ⚠️ fixed viewport/migrate (this audit) |
| Exported JSON | `examples/graph/*.graph.json` |

## aiogram 3 codegen migration

| Area | Status |
|------|--------|
| `registerAllBlockCompilers` | ✅ |
| Keyboard AST bind | ✅ (`applyKeyboardBinding`) |
| Callback strict mode | ✅ with autoFix |
| FSM / routers in output | ✅ via `buildPythonModule` |
| Standalone keyboard block emit | Intentionally empty (bind phase) |

## Files safe to delete (post-sign-off)

See `DEAD_CODE_REPORT.md`. Do **not** delete `core/ai/llmOutput.js` until AI path fully graph-native.

## Migration checklist (remaining)

- [ ] Platform: IR-only `GraphControlPlane.from_graph(document)` — no `parse_dsl`
- [ ] Remove `compiler/legacy_bridge.parse_dsl` from routes or return 410 Gone
- [ ] Update `CORE_COMPATIBILITY.md`, `platform/README.md`, landing copy
- [ ] Rename `dslRunner.mjs` → `pythonBotRunner.mjs` (optional)
- [ ] Commit or remove `core/tests/tools/ast_build_graph.py` (currently skipped in tests)
- [ ] Remove unused `core/legacyDslWarn.js`

## Audit delta (2026-05-22)

- [x] Removed `/v1/compile` route from FastAPI app wiring.
- [x] Removed `platform/.../compiler/legacy_bridge.py` and `runtime/legacy_bridge.py`.
- [x] Constructor/runtime execute routes no longer accept DSL payload.
- [x] `projects` API now stores `graph_document` instead of `stacks`.
- [x] Added `validateGraph()` + zod graph contracts + examples/graph contract tests.
