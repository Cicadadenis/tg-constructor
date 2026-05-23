# Fix Plan — Phased Recovery

## Phase 0 — Done in this audit (2026-05-22)

- [x] `loadExampleGraph`: validate, migrate error toast, viewport fit, skip autosave/repair
- [x] `COL_Y_STRIDE` 1000 → 320 for visible multi-column examples
- [x] `graph_validate.js` + `graph_viewport.js`
- [x] `pipeline.js` success returns `aborted: false`
- [x] Platform: remove `ensure_legacy_path` from `native_core` import and `GraphControlPlane.__init__`
- [x] Tests: keyboard AST phase, callback-strict, skip missing Python tools
- [x] `canonical_ast_json.py` restored for one test

## Phase 1 — Platform IR-only (1–2 weeks)

1. Add `GraphControlPlane.from_ir_graph(graph: IrProgramGraph, program_stub)` without DSL.
2. Change `api/routes/constructor.py` to accept GraphDocument JSON, not `body.dsl`.
3. Return **410** from `/v1/compile` when body contains DSL, with message pointing to Studio codegen.
4. Rewrite or `pytest.mark.skip` platform tests that call `parse_dsl`.

## Phase 2 — UI graph integrity (3–5 days)

1. After `migrateGraphDocument`, toast on `!ok` everywhere (import, cloud open, AI apply).
2. `fitViewport` on project open from cloud.
3. Multi-edge stack projection: optional BFS branches or “branch stacks” UI hint.
4. Remove or wire `CicadaNode.jsx`; drop unused React Flow CSS if confirmed dead.

## Phase 3 — Palette & cache (2 days)

1. Call `invalidateDefaultPropsCache()` when `blockRegistry` hot-reloads (dev hook).
2. Trim `BUILDER_UI_DEFAULT_PROPS` to palette types only.
3. Refresh `GRAPH_UI_NODE_METADATA` via factory in dev.

## Phase 4 — Docs & naming (1 day)

1. Update README, landing, `examples/README.md` to graph JSON + Python export.
2. Optional rename `dslRunner.mjs` → `pythonBotRunner.mjs`.
3. Delete `core/legacyDslWarn.js`.

## Phase 5 — CI hardening

1. Add `npm test` script: `node --test core/tests/*.test.mjs`.
2. Commit `ast_build_graph.py` or permanently skip with issue link.
3. Add `validate_ast.py` or drop schema test.
4. Add ESLint if desired (`package.json` has no `lint` script today).

## Phase 6 — Security

1. Audit `eval_shim` / native expression evaluation boundaries.
2. Confirm `dslRunner` sandbox paths and `PYTHON_MAX_CODE_BYTES`.
3. Scan for secrets in `.env` (not committed).

## Verification gates

```powershell
cd cicada-studio-main
npm run build
cd core; node --test tests/*.test.mjs
npm run ci:codegen
```

## Remaining risks

- Platform API still advertises DSL compile endpoints.
- `App.jsx` complexity → regressions without E2E tests.
- Branching graphs misleading on stack canvas until projection fix.

## Progress 2026-05-22

1. **Phase 1 (legacy stacks):** removed legacy projectGraph stack transforms from `core/graph`; switched to graph-native stack projection module for UI.
2. **Phase 2 (IR-only):** removed compile DSL route and runtime DSL constructor paths in platform API/runtime.
3. **Phase 3 (validation):** implemented `validateGraph(graph)` and wired into hydrate/persist/export/codegen/example-load.
4. **Phase 5 (contracts):** added zod contracts for graph/export/operations/AST/codegen.
5. **Pending:** full `App.jsx` decomposition and complete removal of stack-based canvas renderer.
