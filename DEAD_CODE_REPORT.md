# Dead Code Report

## Safe to delete (after grep confirmation)

| Path | Reason |
|------|--------|
| `core/legacyDslWarn.js` | No importers; `warnLegacyDslExport` unused |
| `src/CicadaNode.jsx` | Not imported in `src/`; editor uses `GraphCanvas` + `BlockStack` |
| `scripts/migrate-app-graph.mjs` | One-off migration script (keep in archive or delete) |
| `dist/` (generated) | Rebuild with `npm run build` |

## Legacy — keep until product copy updated

| Path | Reason |
|------|--------|
| `core/ai/llmOutput.js` | Still used for AI text repair / condition strings |
| `core/dslCondition.js` | Condition parsing in App |
| `core/stacksToDsl.js` | Misnamed but active (`canRenderUi`, codegen re-export) |

## Stale documentation (not code — update or remove)

- `CORE_COMPATIBILITY.md` — references `cic-st-core`
- `platform/README.md`, `platform/docs/ARCHITECTURE.md` — DSL production path
- `docs/compatibility-report.md`
- `fixtures/ai-regression/README.txt` — mentions `generateDSL`
- Landing / `builderI18n.js` — `.ccd` export strings

## Platform dead paths

| Path | Notes |
|------|-------|
| `platform/.../compiler/legacy_bridge.py` | Stub; keep as explicit guard or replace with 410 |
| `platform/.../runtime/legacy_bridge.py` | `LegacyOracle` for parity only |
| `GraphControlPlane.from_dsl` | Non-functional without external parser |

## Unused exports / symbols

- `generateDslFromProjectGraph` — throw-only API
- `GRAPH_UI_NODE_METADATA` static — prefer `listGraphUiNodeCatalogRows()` in hot paths
- `ImportCCD` / `onImportCCD` in `ProjectBar.jsx` — if parent no longer passes handler

## Duplicated packages

- `dotenv` + `.env.example` — standard
- No duplicate React Flow package (custom canvas)

## Files for refactor (not delete)

| Path | Lines | Issue |
|------|-------|-------|
| `src/App.jsx` | ~6070 | God component |
| `server.mjs` | ~6000+ | Monolith |
| `core/codegen/compileCore.js` | ~1200 | Mega transpiler |
