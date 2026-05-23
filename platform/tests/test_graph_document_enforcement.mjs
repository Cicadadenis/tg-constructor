/**
 * GraphDocument enforcement — operation replay, mutation guard, deterministic export.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('../..', import.meta.url)));

await import(join(root, 'src/constructor/graph_document/graph_document.test.js'));

const {
  createGraphEditorStore,
  replayOperations,
  mergeOperationStreams,
  exportGraphDocument,
} = await import(join(root, 'src/constructor/graph_document/index.js'));

const storeA = createGraphEditorStore();
storeA.dispatch('AddNode', { nodeId: 'n1', type: 'start' });
storeA.dispatch('AddNode', { nodeId: 'n2', type: 'message' });
const streamA = storeA.operationStream;

const storeB = createGraphEditorStore();
storeB.dispatch('AddNode', { nodeId: 'n3', type: 'start' });
const streamB = storeB.operationStream;

const merged = mergeOperationStreams(streamA, streamB);
const replayed = replayOperations({}, merged);
assert.equal(replayed.ok, true);
assert.ok(Object.keys(replayed.document.nodes).length >= 2);

const exp1 = exportGraphDocument(storeA.document);
const exp2 = exportGraphDocument(storeA.document);
assert.deepEqual(
  exp1.nodes.map((n) => n.id),
  exp2.nodes.map((n) => n.id),
  'export must be stable for same document',
);

function scanBuilderForMutations() {
  const dir = join(root, 'src/builder');
  const violations = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (/\.(jsx?|tsx?)$/.test(ent.name)) {
        const src = readFileSync(p, 'utf8');
        if (/\bsetNodes\s*\(/.test(src) || /\bsetEdges\s*\(/.test(src)) {
          violations.push(p);
        }
      }
    }
  }
  return violations;
}

const builderMutations = scanBuilderForMutations();
assert.equal(
  builderMutations.length,
  0,
  `builder must not use setNodes/setEdges: ${builderMutations.join(', ')}`,
);

console.log('test_graph_document_enforcement.mjs: ok');
