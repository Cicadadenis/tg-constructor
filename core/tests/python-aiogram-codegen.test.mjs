/**
 * Python aiogram codegen — transpiler layer.
 * Run from core/: node --test tests/python-aiogram-codegen.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  transpileBlockToPython,
  transpileDslInterpolation,
  transpileConditionExpr,
  dslTextToPythonFString,
  compileNodeToPython,
  generatePythonFromStacks,
  stackToPython,
  BLOCK_TO_PYTHON_COMPILER,
} from '../pythonAiogramCodegen.js';
import { parseButtonRows, parseInlineRows, emitReplyKeyboard, emitInlineKeyboard } from '../codegen/keyboards.js';

test('BLOCK_TO_PYTHON_COMPILER exposes aiogram3 palette compilers', () => {
  for (const type of ['message', 'buttons', 'inline', 'save', 'get', 'ask', 'goto', 'start', 'command']) {
    assert.equal(typeof BLOCK_TO_PYTHON_COMPILER[type], 'function', type);
  }
});

test('transpileDslInterpolation maps пользователь.имя', () => {
  const out = transpileDslInterpolation('Привет, {пользователь.имя}!');
  assert.equal(out, 'Привет, {message.from_user.first_name}!');
});

test('message block → await message.answer(f"...")', () => {
  const py = transpileBlockToPython({
    type: 'message',
    props: { text: 'Привет, {пользователь.имя}!' },
  });
  assert.match(py, /await message\.answer\(f"Привет, \{message\.from_user\.first_name\}!"\)/);
});

test('remember → ctx.vars', () => {
  const py = transpileBlockToPython({
    type: 'remember',
    props: { varname: 'x', value: 'y' },
  });
  assert.match(py, /ctx_set_var\(ctx, "x", y\)/);
});

test('set_variable → ctx.vars', () => {
  const py = transpileBlockToPython({
    type: 'set_variable',
    props: { name: 'score', value: '10' },
  });
  assert.match(py, /ctx_set_var\(ctx, "score", 10\)/);
});

test('get_variable → ctx_get_var', () => {
  const py = transpileBlockToPython({
    type: 'get_variable',
    props: { name: 'score', varname: 'score' },
  });
  assert.match(py, /score = ctx_get_var\(ctx, "score"\)/);
});

test('save → ctx_persist_state_key', () => {
  const py = transpileBlockToPython({
    type: 'save',
    props: { key: 'ключ', value: 'value' },
  });
  assert.match(py, /await ctx_persist_state_key\(ctx/);
});

test('get → ctx_sync_state_key', () => {
  const py = transpileBlockToPython({
    type: 'get',
    props: { key: 'ключ', varname: 'x' },
  });
  assert.match(py, /await ctx_sync_state_key\(ctx, "ключ"/);
  assert.match(py, /x = ctx_get_var\(ctx, "x"\)/);
});

test('buttons → ReplyKeyboardMarkup (AST bind phase)', () => {
  assert.equal(transpileBlockToPython({ type: 'buttons', props: { rows: 'A, B' } }), '');
  const rows = parseButtonRows('A, B');
  const py = emitReplyKeyboard(rows, 'kb_test');
  assert.match(py, /ReplyKeyboardMarkup/);
  assert.match(py, /KeyboardButton\(text="A"\)/);
});

test('inline → InlineKeyboardMarkup (AST bind phase)', () => {
  assert.equal(transpileBlockToPython({ type: 'inline', props: { buttons: 'Текст → cb' } }), '');
  const rows = parseInlineRows('Текст → cb');
  const py = emitInlineKeyboard(rows, 'kb_inline');
  assert.match(py, /InlineKeyboardMarkup/);
  assert.match(py, /callback_data="cb"/);
});

test('ask → answer + set_state', () => {
  const py = transpileBlockToPython({
    type: 'ask',
    props: { question: 'Введите имя:', varname: 'name' },
  }, { fsmStates: new Map() });
  assert.match(py, /await message\.answer\("Введите имя:"\)/);
  assert.match(py, /await state\.set_state\(Form\.name\)/);
});

test('transpileConditionExpr DSL builtins', () => {
  assert.match(transpileConditionExpr('начинается_с(кнопка, "cat:")'), /\.startswith\("cat:"\)/);
  assert.match(transpileConditionExpr('длина(x)'), /len\(x\)/);
  assert.match(transpileConditionExpr('содержит_элемент(list, x)'), /x in list/);
});

test('callback with label → F.text filter', () => {
  const py = transpileBlockToPython({ type: 'callback', props: { label: 'Текст' } });
  assert.match(py, /@router\.message\(F\.text == "Текст"\)/);
});

test('callback with label → message handler (reply keyboard, not CallbackQuery)', () => {
  const py = stackToPython({
    blocks: [
      { type: 'callback', props: { label: 'Привет' } },
      { type: 'message', props: { text: 'Привет-привет!' } },
    ],
  });
  assert.match(py, /@router\.message\(F\.text == "Привет"\)/);
  assert.match(py, /async def handle_press_привет\(message: Message, state: FSMContext\)/);
  assert.match(py, /await message\.answer\("Привет-привет!"\)/);
  assert.doesNotMatch(py, /callback: CallbackQuery/);
  assert.doesNotMatch(py, /callback\.answer\(\)/);
});

test('db_delete → ctx.state data.pop', () => {
  const py = transpileBlockToPython({ type: 'db_delete', props: { key: 'мой_ключ' } });
  assert.match(py, /_data\.pop\("мой_ключ", None\)/);
  assert.match(py, /ctx\["vars"\]\.pop\("мой_ключ", None\)/);
});

test('voice + sticker + delete + reply stack (user example)', () => {
  const py = stackToPython({
    blocks: [
      { type: 'on_voice', props: {} },
      { type: 'on_sticker', props: {} },
      { type: 'db_delete', props: { key: 'мой_ключ' } },
      { type: 'message', props: { text: 'Привет, {пользователь.имя}!' } },
    ],
  });

  assert.match(py, /@router\.message\(F\.voice\)/);
  assert.match(py, /@router\.message\(F\.sticker\)/);
  assert.match(py, /data\.pop\("мой_ключ", None\)/);
  assert.match(
    py,
    /await message\.answer\(f"Привет, \{message\.from_user\.first_name\}!"\)/,
  );
});

test('generatePythonFromStacks builds full aiogram module', () => {
  const mod = generatePythonFromStacks([
    {
      blocks: [
        { type: 'bot', props: { token: 'TOKEN' } },
      ],
    },
    {
      blocks: [
        { type: 'commands', props: { commands: '"/start" - "Старт"' } },
      ],
    },
    {
      blocks: [
        { type: 'command', props: { cmd: 'start' } },
        { type: 'message', props: { text: 'Hi' } },
      ],
    },
  ]);
  assert.match(mod, /^"""Generated by Cicada Studio/);
  assert.match(mod, /bot = Bot\(token="TOKEN"\)/);
  assert.match(mod, /dp = Dispatcher\(\)/);
  assert.match(mod, /BotCommand\(command="start", description="Старт"\)/);
  assert.match(mod, /@router\.message\(Command\("start"\)\)/);
  assert.match(mod, /async def main\(\):/);
});

test('global → _RUNTIME_CTX_DEFAULTS', () => {
  const mod = generatePythonFromStacks([
    { blocks: [{ type: 'global', props: { varname: 'X', value: '123' } }] },
    { blocks: [{ type: 'start', props: {} }, { type: 'message', props: { text: 'ok' } }] },
  ]);
  assert.match(mod, /"X": 123/);
  assert.match(mod, /X = ctx_get_var\(ctx, "X"\)/);
  assert.doesNotMatch(mod, /^X = 123$/m);
});

test('compileNodeToPython with children', () => {
  const py = compileNodeToPython({
    type: 'on_text',
    payload: {},
    children: [{ type: 'message', payload: { text: '{сообщение.text}' } }],
  });
  assert.match(py, /@router\.message\(StateFilter\(None\), F\.text\)/);
  assert.match(py, /ctx = build_runtime_ctx/);
  assert.match(py, /message\.text/);
});

test('dslTextToPythonFString plain string without braces', () => {
  assert.equal(dslTextToPythonFString('OK'), '"OK"');
});
