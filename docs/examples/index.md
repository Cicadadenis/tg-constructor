# Aiogram 3 Example Bots (AST-first)

All examples use the **Graph → Rules → AST Bind → Validate → Codegen** pipeline. No post-process keyboard hacks, no `\u2060` ghost messages, no aiogram v2 `executor` / `register_*_handler` patterns.

Source of truth (editable): `src/examples/flows/*.js`  
Exported snapshots: `examples/graph/*.graph.json`

## Categories

| Key | Category | Description |
|-----|----------|-------------|
| `echo` | [basic_handlers](basic_handlers.md) | Start, /help, reply keyboard, text echo |
| `shop` | basic_handlers | Catalog, cart commands, reply buttons |
| `weather` | [keyboards](keyboards.md) | City menu — keyboards bound to `message.answer` |
| `keyboards` | keyboards | Reply + inline AST binding demo |
| `fsm` | [fsm](fsm.md) | `/profile` — `ask` + `save` + StatesGroup |
| `callbacks` | [callbacks](callbacks.md) | Inline `callback_data` + `callback_query` handlers |
| `media` | [media](media.md) | Photo, video, document, `on_photo` |
| `full` | [advanced_routing](advanced_routing.md) | Globals, condition/else, commands, inline |
| `fullTest` | advanced_routing | Palette smoke test |

## Required bot.py shape

```python
from aiogram import Bot, Dispatcher, Router

bot = Bot(token="...")
dp = Dispatcher()
router = Router()

@router.message(...)
async def handle_...(message: Message, state: FSMContext):
    kb_x = ReplyKeyboardMarkup(...)  # only when bound to output
    await message.answer("text", reply_markup=kb_x)  # single send

async def main():
    dp.include_router(router)
    await dp.start_polling(bot)
```

## Keyboard rules (examples)

- `buttons` / `inline` nodes are **never** standalone sends.
- Bind order in graph: `message` ← `buttons` (before or after output node in stack).
- Compiler merges markup into **one** `answer` / `answer_photo` / … call.

## Callback rules (examples)

- Inline `callback_data` must have a matching handler (`callback` entry with `callbackPrefix`) or compile-time stub (warnings in UI).
- Examples in `callbacks` and `keyboards` use **explicit** `@router.callback_query` handlers — not stub-only demos.

## Legacy `.ccd` files

Files in `examples/*.ccd` are **archived** Cicada DSL sources. Load graphs from the builder **Примеры** menu or import `examples/graph/*.graph.json`.

## Validation

```bash
cd core && node --test tests/examples-library.test.mjs
```
