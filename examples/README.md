# Examples (aiogram 3 AST-first)

## Use these (production)

| Path | Format |
|------|--------|
| `src/examples/flows/` | Graph flow modules (loaded in UI) |
| `examples/graph/*.graph.json` | Exported snapshots for import/CI |
| `docs/examples/index.md` | Categorized index |

Open in Cicada Studio: **Примеры** menu → Echo, Weather, Shop, Keyboards, FSM, Callbacks, Media, Routing, Full Test.

## Archived (do not use for codegen)

| Path | Status |
|------|--------|
| `*.ccd` in this folder | Legacy Cicada DSL — not compiled to `bot.py` |
| `cic-st-core/examples/` | Old interpreter samples |

Migrate custom bots by rebuilding graphs in the constructor (palette blocks only) or importing `examples/graph/<name>.graph.json`.

## Standards checklist

- [x] `Router` + `dp.include_router(router)`
- [x] Keyboards bound to output nodes (no ghost `message.answer('\u2060')`)
- [x] FSM via `ask` / `StatesGroup` inside handlers
- [x] Callback handlers declared in graph (not runtime source patching)
- [ ] No `executor`, `register_message_handler`, or aiogram v2 imports
