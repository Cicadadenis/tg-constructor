import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findForbiddenImportsInSource } from '../../src/constructor/uiLayerGuard.js';

const root = join(fileURLToPath(new URL('../..', import.meta.url)), 'src');

function scanSubdir(sub) {
  const dir = join(root, sub);
  const files = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, ent.name);
      if (ent.isDirectory() && ent.name !== 'node_modules') stack.push(p);
      else if (/\.(jsx?|tsx?)$/.test(ent.name) && !/\.test\.(jsx?|tsx?)$/.test(ent.name)) files.push(p);
    }
  }
  const violations = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const hits = findForbiddenImportsInSource(src, { filePath: file });
    const allowedBridge = file.includes('blockUiRules.js');
    for (const h of hits) {
      if (allowedBridge && h.spec.includes('core/runtime/rules')) continue;
      violations.push({ file, ...h });
    }
  }
  return violations;
}

const builderHits = scanSubdir('builder');
const constructorHits = scanSubdir('constructor').filter(
  (v) => !v.file.includes('blockUiRules.js')
    && !v.file.includes('stacks_dispatch_payload.js')
    && !v.file.includes('graph_import.js')
    && !v.file.includes('graph_stack_ops.js')
    && !v.file.includes('graph_operation_client.js')
    && !v.file.includes('graph_ui_compositions.js')
    && !v.file.includes('graph_composition_guard.js')
    && !v.file.includes('graph_compiler_vm_contract.js')
    && !v.file.includes('graph_ui_orchestrator.js')
    && !v.file.includes('graph_ui_palette.js')
    && !v.file.includes('block_palette.js')
    && !v.file.includes('block_registry.js')
    && !v.file.includes('dsl_blocks.js'),
);

assert.equal(
  builderHits.length,
  0,
  `builder forbidden imports: ${JSON.stringify(builderHits, null, 2)}`,
);
assert.equal(
  constructorHits.length,
  0,
  `constructor forbidden imports: ${JSON.stringify(constructorHits, null, 2)}`,
);

console.log('ui layer guard: ok');
