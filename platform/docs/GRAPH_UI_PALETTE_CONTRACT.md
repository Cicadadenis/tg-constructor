# Graph UI palette contract

The constructor left sidebar («Блоки») is a **merged palette** built in `graph_ui_palette.js`:

1. **Operation tools** (`type: "operation"`) from `GRAPH_UI_OPERATION_METADATA`
2. **Node catalog** (`type: "node"`, `id: "node:<blockType>"`) from `builderBlockTypes` / `getPaletteBlockTypes()`

All drag/tap gestures still compile to canonical `GRAPH_OPERATION_TYPES` (node rows use `operationType: "AddNode"`).

## Single source of truth

| Layer | Module | Role |
|-------|--------|------|
| Operation enum | `graph_schema.js` → `GRAPH_OPERATION_TYPES` | Canonical mutation language |
| UI metadata | `graph_ui_compositions.js` → `GRAPH_UI_OPERATION_METADATA` | Labels, icons, palette visibility, `compileFn` |
| Palette builder | `graph_ui_palette.js` | `buildGraphUiPalette()`, `compilePaletteAction()` |
| Runtime apply | `graph_operation_client.js` → `applyComposition()` | Dispatch compiled IR |

## Palette mapping (examples)

| Operation | Palette | Interaction |
|-----------|---------|-------------|
| `AddNode` | Узел / Node | Drag onto canvas → `compileAddNewStack` or `compileAddBlockToStack` |
| `AddEdge` | Связать / Connect | Canvas connect gesture (not legacy DSL block) |
| `UpdateNodeData` | Правка / Edit | Selection → properties panel |
| `RemoveNode` | Удалить / Remove | Selection → `compileRemoveNode` |
| `MoveNode` | — | Canvas drag only (no palette row) |
| `UpdateViewport` | — | Zoom / pan |
| `GroupSelection` | — | Canvas multi-select |

Studio block types (bot, command, message, …) appear as **`node:<type>`** palette rows with `runtime: 'aiogram3'`. Each maps to `AddNode` via `compileAddNewStack` / `compileAddBlockToStack`. Legacy DSL/Cicada blocks are not in the palette.

## Forbidden palette sources (runtime + CI)

- `block_palette.js`, `block_registry.js`, `dsl_blocks.js` (deprecated shims — warn on import)
- `getPaletteBlockTypes()` from `core/blockRegistry.js` as sidebar source
- Static `BLOCK_TYPES` / `cicada/new-type` drag payloads in `Sidebar`
- Direct stack mutation without `compile*` → `applyComposition`

`uiLayerGuard.scanSourceForLegacyPaletteSources` and `platform/tests/test_ui_palette_consistency.js` enforce this.

## Sidebar stability

- `normalizePaletteCategory()` — unknown ids → `main`; maps Russian `group` labels via `RU_GROUP_TO_ID`.
- `groupPaletteForSidebar()` — renders **all** entries; `sectionOrder` is deduped (`data` must not appear twice).
- `assertPaletteIntegrity()` — CI/dev check: operations + nodes present, grouped count === palette length.
- `compilePaletteAction()` — `type: "node"` uses `compileAddNewStack` / `compileAddBlockToStack` only (no operation-metadata branch).

## Apply path

```
Sidebar drag/tap
  → compilePaletteAction(entry, context)
  → applyComposition(graph, compiled)
  → GraphEditorStore.dispatch(canonical op)
```

**Never:** palette → DSL executor, legacy block schema, or ad-hoc `ReplaceGraphDocument`.

## Legacy detection

Palette entries must declare `runtime: 'aiogram3'`; `assertPaletteContract` rejects other runtimes.

## Related

- `platform/docs/GRAPH_UI_COMPOSITION_CONTRACT.md`
- `platform/docs/GRAPH_OPERATION_FINAL_ARCHITECTURE.md`
