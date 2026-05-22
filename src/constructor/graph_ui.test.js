import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createGraphEditorStore } from './graph_document/graph_editor_store.js';
import { scanSourceForForbiddenGraphMutations } from './graph_document/graph_mutation_guard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(__dirname, '../App.jsx'), 'utf8');
const hookSource = fs.readFileSync(path.join(__dirname, 'graph_document/useGraphEditor.js'), 'utf8');

assert.ok(!appSource.includes('useState(stacks)'), 'App must not use useState(stacks)');
assert.ok(!appSource.includes('setStacks('), 'App must not call setStacks');
assert.ok(appSource.includes('useGraphEditor'), 'App must use GraphEditor');
assert.ok(appSource.includes('GraphCanvas'), 'App must render GraphCanvas');
assert.ok(appSource.includes('getGraphDocument'), 'App must read GraphDocument from store');
assert.ok(appSource.includes('migrateGraphDocument'), 'App must use GraphDocument migration for load');
assert.ok(!appSource.includes('graph.importStacks'), 'App must not call graph.importStacks');
assert.ok(!appSource.includes('mutateStacks'), 'App must not call mutateStacks');

const hits = scanSourceForForbiddenGraphMutations(appSource);
assert.equal(hits.length, 0, `forbidden mutations in App.jsx: ${JSON.stringify(hits)}`);

for (const term of ['mutateStacks', 'replaceStacks', 'importStacks', 'importGraph', 'stacksView']) {
  assert.ok(!hookSource.includes(term), `hook must not expose ${term}`);
}

const store = createGraphEditorStore();
store.dispatch('AddNode', { nodeId: 'b1', type: 'start', position: { x: 0, y: 0 } });
assert.equal(store.getGraphDocument().nodes.b1.type, 'start');

console.log('graph_ui.test.js: ok');
