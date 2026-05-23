/**
 * AST keyboard binding + aiogram 3 codegen (no ghost messages).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePythonFromStacks, stackToPython } from '../pythonAiogramCodegen.js';
import { applyKeyboardBinding, applyUiAttachmentsBinding, bindStacksForCodegen } from '../codegen/ast/bindKeyboards.js';
import { CodegenError } from '../codegen/errors.js';
import { postProcessAiogramModule, scanHandlerResponseWarnings } from '../codegen/postProcess.js';

test('keyboard only → KeyboardWithoutOutputNode', () => {
  const bind = applyKeyboardBinding([{
    blocks: [
      { id: 's', type: 'start', props: {} },
      { id: 'k', type: 'buttons', props: { rows: 'OK' } },
    ],
  }]);
  assert.equal(bind.ok, false);
  assert.equal(bind.errors[0].code, 'KeyboardWithoutOutputNode');
  assert.throws(
    () => stackToPython({
      blocks: [
        { type: 'start', props: {} },
        { type: 'buttons', props: { rows: 'OK' } },
      ],
    }),
    CodegenError,
  );
});

test('uiAttachments buttons on message → reply_markup in codegen', () => {
  const py = stackToPython({
    blocks: [
      { id: 'c', type: 'command', props: { cmd: 'menu' } },
      {
        id: 'm',
        type: 'message',
        props: { text: 'Меню' },
        uiAttachments: {
          buttons: [{ id: 'ua1', text: 'OK' }, { id: 'ua2', text: 'Отмена' }],
          inline: [],
          replies: [],
          media: [],
          transitions: [],
        },
      },
    ],
  });
  assert.match(py, /ReplyKeyboardMarkup/);
  assert.match(py, /KeyboardButton\(text="OK"\)/);
  assert.match(py, /await message\.answer\("Меню", reply_markup=kb_/);
});

test('uiAttachments inline on message → inline keyboard in codegen', () => {
  const bind = bindStacksForCodegen([{
    blocks: [
      { id: 's', type: 'start', props: {} },
      {
        id: 'm',
        type: 'message',
        props: { text: 'Pick' },
        uiAttachments: {
          inline: [{ id: 'ua1', text: 'Go', callback: 'go_cb' }],
          buttons: [],
          replies: [],
          media: [],
          transitions: [],
        },
      },
      { id: 'cb', type: 'callback', props: { data: 'go_cb' } },
      { id: 'r', type: 'message', props: { text: 'ok' } },
    ],
  }]);
  assert.equal(bind.ok, true);
  const msg = bind.stacks[0].blocks.find((b) => b.id === 'm');
  assert.equal(msg?.boundKeyboard?.type, 'inline');
});

test('buttons then message → single answer with reply_markup', () => {
  const py = stackToPython({
    blocks: [
      { id: 'c', type: 'command', props: { cmd: 'menu' } },
      { id: 'k', type: 'buttons', props: { rows: 'OK' } },
      { id: 'm', type: 'message', props: { text: 'Выберите' } },
    ],
  });
  const kbAssigns = (py.match(/kb_\w+ = ReplyKeyboardMarkup/g) || []).length;
  assert.equal(kbAssigns, 1);
  assert.match(py, /await message\.answer\("Выберите", reply_markup=kb_/);
  assert.doesNotMatch(py, /\\u2060/);
  assert.equal((py.match(/await message\.answer/g) || []).length, 1);
});

test('inline without output before delay fails bind', () => {
  const bind = applyKeyboardBinding([{
    blocks: [
      { id: 's', type: 'start', props: {} },
      { id: 'i', type: 'inline', props: { buttons: 'OK → ok_cb' } },
      { id: 'd', type: 'delay', props: { seconds: '1' } },
    ],
  }]);
  assert.equal(bind.ok, false);
  assert.equal(bind.errors[0].code, 'KeyboardWithoutOutputNode');
});

test('full module: inline without handler fails strict compile', () => {
  assert.throws(
    () => generatePythonFromStacks([
      { blocks: [{ type: 'bot', props: { token: 'T' } }] },
      {
        blocks: [
          { id: 's', type: 'start', props: {} },
          { id: 'i', type: 'inline', props: { buttons: 'Go → go_action' } },
          { id: 'm', type: 'message', props: { text: 'Pick' } },
        ],
      },
    ]),
    (e) => /MissingCallbackHandlerError|callback_data/i.test(e?.message || ''),
  );
});

test('photo + buttons stack → answer_photo with reply_markup', () => {
  const py = stackToPython({
    blocks: [
      { id: 's', type: 'start', props: {} },
      { id: 'k', type: 'buttons', props: { rows: 'OK' } },
      { id: 'p', type: 'photo', props: { url: 'https://x/p.jpg', caption: 'Hi' } },
    ],
  });
  assert.match(py, /answer_photo\(/);
  assert.match(py, /reply_markup=kb_/);
  assert.match(py, /ReplyKeyboardMarkup/);
});

test('postProcess only scans handler warnings (no kb patch)', () => {
  const src = [
    'dp = Dispatcher()',
    'router = Router()',
    '@router.message(CommandStart())',
    'async def handle_start(message: Message, state: FSMContext):',
    '    x = 1',
    'async def main():',
    '    dp.include_router(router)',
  ].join('\n');
  const warnings = scanHandlerResponseWarnings(src);
  assert.ok(warnings.some((w) => /handle_start/.test(w) && /answer/.test(w)));
  const { code } = postProcessAiogramModule(src);
  assert.equal(code, src);
});
