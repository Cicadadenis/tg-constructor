# Critical Bugs — Prioritized

## P0 — User-visible / production

| ID | Bug | Impact | Status |
|----|-----|--------|--------|
| C-01 | Example graphs load off-screen (COL_Y_STRIDE + no viewport fit) | Users think examples broken | **Fixed** |
| C-02 | `migrateGraphDocument` failures silent on example load | Empty/partial canvas | **Fixed** |
| C-03 | Autosave reload overwrites example on `canvasStorageKey` change | Example “doesn’t stick” | Mitigated (skip save on load) |
| C-04 | Platform `native_core` import calls `ensure_legacy_path()` | Any import crashes | **Fixed** |
| C-05 | `GraphControlPlane.__init__` called `ensure_legacy_path()` | Graph runtime unusable | **Fixed** |
| C-06 | `constructor.py` / `/v1/compile` use `parse_dsl` stub | API execute always fails | **Open** |
| C-07 | Callback repair re-layout destroys example positions | Blocks jump after load | Mitigated (skip repair on example load) |

## P1 — Correctness / CI

| ID | Bug | Impact | Status |
|----|-----|--------|--------|
| C-08 | `compileGraphToPython` success missing `aborted: false` | Tests / clients misread abort | **Fixed** |
| C-09 | Keyboard unit tests expect standalone transpile | CI false negatives | **Fixed** |
| C-10 | Missing `core/tests/tools/ast_build_graph.py` | 4 tests fail | Skipped when missing |
| C-11 | Missing `validate_ast.py`, `validate_project_manifest.py` | 2 tests fail | Skipped when missing |
| C-12 | `projectGraphToLegacyStacks` single-edge chain | Wrong visual for branches | **Open** |

## P2 — Security / stability

| ID | Bug | Impact | Status |
|----|-----|--------|--------|
| C-13 | No graph validation on import/example before migrate | Corrupt graphs enter store | **Fixed** (`graph_validate.js`) |
| C-14 | `eval` in platform runtime (`eval_shim`) | Expression eval in sandbox — review policy | **Open** (by design) |
| C-15 | Large `App.jsx` (~6k lines) | Regression risk, hook ordering bugs | **Open** |

## Broken flows

1. **Platform sandbox compile** — DSL string → `parse_dsl` → RuntimeError  
2. **Import .ccd** — UI toast “DSL import removed” (intentional)  
3. **Legacy parity tests** — require external `cic-st-core`  
4. **Multi-branch graphs on canvas** — only first edge in stack chain shown linearly  

## Broken examples

All 9 example modules **compile in CI**; UI issues were **viewport/migration**, not bad JSON.

## Broken generators

- Platform `CompilePipeline.compile(dsl)` — broken (stub parser)  
- Studio `generateDslFromProjectGraph` — throws (intentional)  
- Studio Python codegen — **working**

## Broken imports

- `from cicada.executor` in platform tests — external package only  
- `CicadaNode.jsx` — no importer in `src/` (dead component)

## Update 2026-05-22

- C-12 (`projectGraphToLegacyStacks` single-edge chain) — **Closed** in `core/graph`; stack view now uses graph-native segment projection.
- DSL compile surface (`/v1/compile`, `parse_dsl` runtime path) — **Closed**.
- New risk: project rows with old `stacks` payload require one-time data migration to `graph_document` in production DB.
