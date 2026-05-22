/**
 * Example graph library — AST-first compile validation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXAMPLE_GRAPH_FLOWS,
  EXAMPLE_CATEGORIES,
  EXAMPLE_KEYS,
} from '../../src/examples/flows/index.js';
import { compileGraphToPython } from '../codegen/pipeline.js';
import { validateAiogram3Graph } from '../rules/aiogram3RuleEngine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const graphOutDir = join(__dirname, '..', '..', 'examples', 'graph');

test('example library exports expected keys', () => {
  for (const key of ['echo', 'weather', 'shop', 'keyboards', 'fsm', 'callbacks', 'media', 'full', 'fullTest']) {
    assert.ok(EXAMPLE_KEYS.includes(key), `missing ${key}`);
    assert.ok(EXAMPLE_GRAPH_FLOWS[key]?.nodes?.length, `${key} empty`);
    assert.ok(EXAMPLE_CATEGORIES[key], `${key} category`);
  }
});

for (const key of EXAMPLE_KEYS) {
  test(`example «${key}» passes rules + codegen (AST-first)`, () => {
    const flow = EXAMPLE_GRAPH_FLOWS[key];
    const rules = validateAiogram3Graph(flow);
    assert.equal(
      rules.ok,
      true,
      `${key} rules: ${rules.errors.map((e) => e.message).join('; ')}`,
    );

    const out = compileGraphToPython(flow, {
      strict: false,
      validatePython: false,
    });
    assert.equal(out.compileErrors.length, 0, `${key}: ${out.compileErrors.map((e) => e.message).join('; ')}`);
    assert.ok(out.code?.includes('router = Router()'), `${key}: missing Router`);
    assert.ok(out.code?.includes('dp = Dispatcher()'), `${key}: missing Dispatcher`);
    assert.ok(out.code?.includes('dp.include_router(router)'), `${key}: missing include_router`);
    assert.doesNotMatch(out.code, /\\u2060/, `${key}: ghost message`);
    assert.doesNotMatch(out.code, /register_message_handler|executor\.start_polling/, `${key}: legacy aiogram v2`);
  });
}

test('export graph JSON snapshots to examples/graph/', () => {
  mkdirSync(graphOutDir, { recursive: true });
  for (const key of EXAMPLE_KEYS) {
    const path = join(graphOutDir, `${key}.graph.json`);
    writeFileSync(path, `${JSON.stringify(EXAMPLE_GRAPH_FLOWS[key], null, 2)}\n`, 'utf8');
    const raw = readFileSync(path, 'utf8');
    assert.ok(raw.includes('"nodes"'));
  }
});
