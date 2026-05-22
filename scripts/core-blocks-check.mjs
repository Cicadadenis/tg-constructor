#!/usr/bin/env node
/**
 * Palette smoke: each aiogram3 block type has a compiler and emits Python fragments.
 */
import { compileNodeToPython, generatePythonFromStacks } from '../core/codegen/index.js';
import { validateAiogram3Graph } from '../core/rules/aiogram3RuleEngine.js';
import { AIOGRAM3_PALETTE_BLOCK_TYPES } from '../core/aiogram3Runtime.js';
import { BLOCK_TO_PYTHON_COMPILER } from '../core/codegen/index.js';

const sampleProps = {
  version: { version: '1.0' },
  bot: { token: 'TEST' },
  commands: { commands: '/start' },
  global: { varname: 'x', value: '0' },
  command: { cmd: 'help' },
  callback: { label: 'ok', data: 'cb_ok' },
  message: { text: 'Hi' },
  buttons: { rows: 'A, B' },
  inline: { buttons: 'Site|url:https://example.com' },
  ask: { question: 'Name?', varname: 'name' },
  remember: { varname: 'name' },
  condition: { cond: 'name' },
  stop: {},
  start: {},
  on_text: {},
  on_photo: {},
  on_voice: {},
  on_document: {},
  on_sticker: {},
  on_location: {},
  on_contact: {},
  else: {},
};

const handlerStack = [
  { id: 's0', x: 40, y: 40, blocks: [{ id: 'b_bot', type: 'bot', props: { token: 'TEST' } }] },
  {
    id: 's1',
    x: 400,
    y: 40,
    blocks: [
      { id: 'b_start', type: 'start', props: {} },
      { id: 'b_msg', type: 'message', props: { text: 'ok' } },
      { id: 'b_stop', type: 'stop', props: {} },
    ],
  },
];

const rules = validateAiogram3Graph(handlerStack);
let moduleCode = '';
try {
  moduleCode = generatePythonFromStacks(handlerStack, { strict: false });
} catch (e) {
  console.error('handler stack codegen failed:', e?.message || e);
  process.exit(1);
}

if (!rules.ok || !moduleCode.includes('Router()')) {
  console.error('handler stack rules/codegen failed');
  process.exit(1);
}

const KEYBOARD_BIND_TYPES = new Set(['buttons', 'inline']);

const rows = AIOGRAM3_PALETTE_BLOCK_TYPES.map((type) => {
  const hasCompiler = Boolean(BLOCK_TO_PYTHON_COMPILER[type]);
  let fragment = '';
  let err = '';
  try {
    fragment = compileNodeToPython({ type, props: sampleProps[type] || {} }, { indent: '    ' });
  } catch (e) {
    err = e?.message || String(e);
  }
  let ok = hasCompiler && typeof fragment === 'string' && !err;
  if (KEYBOARD_BIND_TYPES.has(type)) {
    const kbStack = [
      { id: 's0', x: 40, y: 40, blocks: [{ id: 'b_bot', type: 'bot', props: { token: 'TEST' } }] },
      {
        id: 's_kb',
        x: 400,
        y: 40,
        blocks: [
          { id: 'b_start', type: 'start', props: {} },
          { id: 'b_kb', type, props: sampleProps[type] },
          { id: 'b_msg', type: 'message', props: { text: 'ok' } },
          { id: 'b_stop', type: 'stop', props: {} },
        ],
      },
    ];
    try {
      const code = generatePythonFromStacks(kbStack, { strict: false });
      const markup = type === 'buttons' ? 'ReplyKeyboardMarkup' : 'InlineKeyboardMarkup';
      ok = validateAiogram3Graph(kbStack).ok && code.includes(markup);
    } catch (e) {
      ok = false;
      err = e?.message || String(e);
    }
  } else {
    ok = ok && fragment.trim().length > 0;
  }
  return { type, ok, err, hasCompiler };
});

for (const row of rows) {
  console.log(`${row.ok ? '✓' : '✗'} ${row.type}${row.hasCompiler ? '' : ' (no compiler)'}`);
  if (!row.ok && row.err) console.log(`  ${row.err}`);
}

const failed = rows.filter((r) => !r.ok);
console.log(`\nИтого: ${rows.length - failed.length}/${rows.length} типов с codegen-фрагментом + handler stack OK.`);
if (failed.length) process.exit(1);
