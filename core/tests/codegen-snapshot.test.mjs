/**
 * Snapshot: graph.json → expected Python (aiogram 3).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compileGraphToPython } from '../codegen/pipeline.js';
import { validatePythonSyntax } from '../codegen/validatePython.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, 'fixtures', 'codegen');

test('simple_start.graph.json → aiogram module', () => {
  const flow = JSON.parse(
    readFileSync(join(fixtures, 'simple_start.graph.json'), 'utf8'),
  );
  const { code, compileErrors } = compileGraphToPython(flow, { validatePython: true, strict: false });
  assert.equal(compileErrors.length, 0, compileErrors.map((e) => e.message).join('; '));
  assert.match(code, /bot = Bot\(token="TEST_TOKEN"\)/);
  assert.match(code, /dp = Dispatcher\(\)/);
  assert.match(code, /@router\.message\(CommandStart\(\)\)/);
  assert.match(code, /await message\.answer\("Привет!"\)/);
  assert.match(code, /async def main\(\):/);
  assert.match(code, /await dp\.start_polling\(bot\)/);
  assert.match(code, /asyncio\.run\(main\(\)\)/);
  const py = validatePythonSyntax(code);
  assert.equal(py.ok, true, py.error);
});

test('empty graph returns empty preview (no bot.py skeleton)', () => {
  const { code, empty, compileErrors } = compileGraphToPython({ nodes: [], edges: [] });
  assert.equal(empty, true);
  assert.equal(code, '');
  assert.equal(compileErrors.length, 0);
});

test('missing compiler surfaces compile error', () => {
  const flow = {
    nodes: [
      {
        id: 'x',
        type: 'cicada',
        data: { type: 'totally_unknown_block_xyz', props: {} },
      },
    ],
    edges: [],
  };
  const { compileErrors, code } = compileGraphToPython(flow, { validatePython: false });
  assert.ok(compileErrors.length > 0);
  assert.ok(
    compileErrors.some((e) =>
      /UNKNOWN_BLOCK_TYPE|неизвестный|Missing compiler|компилятор/i.test(e.message || ''),
    ),
  );
  assert.equal(code, '');
});
