# Справочник блоков → код aiogram 3

Документ описает **все блоки палитры конструктора** (`runtime: aiogram3`): внутренний `type`, название в UI и то, как блок попадает в сгенерированный `bot.py`.

Общая оболочка модуля (всегда в начале файла):

```python
from aiogram import Bot, Dispatcher, Router, F
from aiogram.filters import Command, CommandStart
from aiogram.types import Message, CallbackQuery, BotCommand
from aiogram.fsm.context import FSMContext
# ...

bot = Bot(token="…")
dp = Dispatcher()
router = Router()
```

В конце: `dp.include_router(router)`, `await dp.start_polling(bot)`.

**Подстановки в тексте:** `{пользователь.имя}` → `message.from_user.first_name`, `{сообщение.text}` → `message.text` и т.д. (f-строки Python).

---

## Настройки (корень сценария)

| type | Название в UI | В коде |
|------|---------------|--------|
| `version` | Версия | Комментарий: `# version "1.0"` |
| `bot` | Бот | Токен из поля блока → `bot = Bot(token="…")` на уровне модуля (не тело хендлера) |
| `commands` | Команды меню | `async def set_commands(bot: Bot):` + `BotCommand(command="start", description="…")` |
| `global` | Глобальная | Переменная модуля: `имя = значение` |

**Пример `global`:**

```python
счётчик = 0

@router.message(CommandStart())
async def handle_start(message: Message, state: FSMContext):
    await message.answer("ok")
```

**Пример `commands`:**

```python
async def set_commands(bot: Bot):
    await bot.set_my_commands([
        BotCommand(command="start", description="Старт"),
    ])
```

---

## Обработчики (корень стека → `@router` + `async def`)

Каждый такой блок открывает **хендлер**. Тело — блоки ниже по стеку.

| type | Название в UI | Декоратор / фильтр |
|------|---------------|-------------------|
| `start` | Старт | `@router.message(CommandStart())` |
| `command` | Команда | `@router.message(Command("имя"))` — из поля `cmd` (без `/`) |
| `callback` | При нажатии | `@router.callback_query(…)` или `@router.message(F.text == "…")` если задан `label`; при `dataPrefix` — `F.data.startswith("…")` |
| `on_photo` | При фото | `@router.message(F.photo)` |
| `on_voice` | При голосовом | `@router.message(F.voice)` |
| `on_document` | При документе | `@router.message(F.document)` |
| `on_sticker` | При стикере | `@router.message(F.sticker)` |
| `on_location` | При локации | `@router.message(F.location)` |
| `on_contact` | При контакте | `@router.message(F.contact)` |
| `else` | Иначе | `@router.message()` — запасной хендлер на любое сообщение |

**Шаблон хендлера:**

```python
@router.message(Command("help"))
async def handle_command_…(message: Message, state: FSMContext):
    await message.answer("…")
```

Для `callback` без текста кнопки:

```python
@router.callback_query()
async def handle_callback_…(callback: CallbackQuery, state: FSMContext):
    …
```

> Блок `else` в **середине** стека (после `condition`) даёт ветку `else:` в Python, а не новый `@router`.

---

## Сообщения и клавиатуры

| type | Название в UI | В коде |
|------|---------------|--------|
| `message` | Ответ | `await message.answer(f"текст")` — при необходимости с `reply_markup=kb_…` от предыдущих кнопок |
| `buttons` | Кнопки | `ReplyKeyboardMarkup` + `KeyboardButton` → переменная `kb_…`; разметка подставляется в **следующий** `message` |
| `inline` | Inline-кнопки | `InlineKeyboardMarkup` + `InlineKeyboardButton(callback_data=…)` → `kb_…` для следующего ответа |

**Пример `message`:**

```python
await message.answer(f"Привет, {message.from_user.first_name}!")
```

**Пример `buttons` + `message`:**

```python
kb_main = ReplyKeyboardMarkup(
    keyboard=[[KeyboardButton(text="Да"), KeyboardButton(text="Нет")]],
    resize_keyboard=True,
)
await message.answer("Выберите:", reply_markup=kb_main)
```

**Пример `inline`:**

```python
kb_inline = InlineKeyboardMarkup(inline_keyboard=[
    [InlineKeyboardButton(text="OK", callback_data="ok")],
])
await message.answer("Нажмите:", reply_markup=kb_inline)
```

---

## Логика и состояние (FSM)

| type | Название в UI | В коде |
|------|---------------|--------|
| `condition` | Если | `if <условие>:` — условие из поля `cond` (DSL → Python) |
| `condition_not` | Если не | `if not (<условие>):` |
| `else` | Иначе | `else:` (внутри ветвления, не корень) |
| `ask` | Спросить | `await message.answer("вопрос")` + `await state.set_state(Form.поле)` |
| `remember` | Запомнить | `переменная = значение` (локально в хендлере) |
| `get` | Получить | `data = await state.get_data()` + `var = data.get("ключ")` |
| `save` | Сохранить | `await state.update_data(ключ=значение)` |
| `set_global` | Обновить глобальную | `переменная = значение` (модульная / глобальная в хендлере) |

**Пример `ask`:**

```python
await message.answer("Как вас зовут?")
await state.set_state(Form.name)
```

**Пример `condition`:**

```python
if message.text == "да":
    await message.answer("Ок")
```

---

## Действия

| type | Название в UI | В коде |
|------|---------------|--------|
| `loop` | Цикл | `for _ in range(N):` / `for item in coll:` / `while условие:` — режим `mode`: count, foreach, while |
| `delay` | Пауза | `await asyncio.sleep(секунды)` |
| `typing` | Печатает... | `await message.chat.do("typing")` + `await asyncio.sleep(…)` |
| `stop` | Стоп | `return` (или `break` / `continue` / `await state.clear()` по `reason`) |
| `goto` | Переход | `await state.set_state(Scenario.step)` — цель из поля `target` |
| `log` | Лог | `logging.info("…")` (уровень из `level`) |

**Пример `loop` (счётчик):**

```python
for _ in range(3):
    await message.answer("шаг")
```

**Пример `delay`:**

```python
await asyncio.sleep(2)
```

---

## Медиа (отправка)

| type | Название в UI | В коде |
|------|---------------|--------|
| `photo` | Фото | `await message.answer_photo(url_or_file_id)` |
| `video` | Видео | `await message.answer_video(…)` |
| `audio` | Аудио | `await message.answer_audio(…)` |
| `document` | Документ | `await message.answer_document(…)` |
| `send_file` | Отправить файл | `await message.answer_document(file_id)` — из поля `file` |
| `photo_var` | Фото из переменной | `await message.answer_photo(переменная)` |
| `document_var` | Документ из переменной | `await message.answer_document(переменная)` |
| `sticker` | Стикер | `await message.answer_sticker(file_id)` |
| `contact` | Контакт | `await message.answer_contact(phone_number=…, first_name=…)` |
| `location` | Локация | `await message.answer_location(latitude=…, longitude=…)` |
| `poll` | Опрос | `await message.answer_poll("вопрос", ["вариант1", …])` |

---

## Скрытые типы (не в палитре, но в старых графах / алиасы)

Компилируются так же, если тип встречается в JSON:

| type | Назначение | В коде |
|------|------------|--------|
| `reply` | = `message` | `await message.answer(…)` |
| `caption` | = `message` | `await message.answer(…)` |
| `pause` | = `delay` | `await asyncio.sleep(…)` |
| `on_text` | Текст | `@router.message(F.text)` |
| `photo_received` | = `on_photo` | `@router.message(F.photo)` |
| `voice_received` | = `on_voice` | `@router.message(F.voice)` |
| `document_received` | = `on_document` | `@router.message(F.document)` |
| `sticker_received` | = `on_sticker` | `@router.message(F.sticker)` |
| `location_received` | = `on_location` | `@router.message(F.location)` |
| `contact_received` | = `on_contact` | `@router.message(F.contact)` |

---

## Полный пример стека

**В конструкторе:** `command` → `message` → `buttons`

**В `bot.py`:**

```python
@router.message(Command("start"))
async def handle_command_start(message: Message, state: FSMContext):
    kb_start = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="Помощь")]],
        resize_keyboard=True,
    )
    await message.answer(f"Старт, {message.from_user.first_name}!", reply_markup=kb_start)
```

---

## Удалённые из палитры (не генерируются)

Эти типы **убраны** из палитры aiogram3; при наличии в старом графе codegen выдаст ошибку «нет компилятора»:

`scenario`, `step`, `middleware`, `block`, `use`, `call_block`, `http`, `database`, `inline_db`, `switch`, `random`, `menu`, `notify`, `payment`, `analytics`, `classify`, `role`, `check_sub`, `member_role`, `forward_msg`, `broadcast`, `db_delete`, `save_global`, `get_user`, `all_keys`

---

## Инструменты графа (не блоки бота)

Операции редактора (`GRAPH_UI_OPERATION_METADATA`), не попадают в `bot.py` как логика бота:

| operation | Название | Назначение |
|-----------|----------|------------|
| `AddNode` | Узел | Добавить блок на холст |
| `RemoveNode` | Удалить | Удалить узел |
| `UpdateNodeData` | Правка | Изменить props узла |
| `AddEdge` | Связать | Связь между узлами |

---

## Пайплайн codegen (AST)

1. **Rule engine** — `validateAiogram3Graph` (в т.ч. `KeyboardWithoutOutputNode`)
2. **AST binding** — `applyKeyboardBinding`: `buttons` / `inline` → `boundKeyboard` на ближайший output (без ghost `message.answer`)
3. **Validation** — `graphToNormalizedAst` + `assertValidAst`
4. **Codegen** — один `await message.answer_*` на output; все `callback_data` требуют явный блок «При нажатии» (strict, без stub)

*Источник истины: `core/aiogram3Runtime.js`, `core/blockRegistry.js`, `core/codegen/ast/bindKeyboards.js`, `core/codegen/compileCore.js`.*
