import assert from 'node:assert/strict';
import { compileGraphToPython } from '../codegen/pipeline.js';
import { createGraphDocument } from '../../src/constructor/graph_document/graph_document.js';
import { graphDocumentToProjectGraph } from '../../src/constructor/graph_document/graph_project_bridge.js';
import { projectGraphToFlow } from '../graph/model.js';

for (const [label, nodes] of [
  ['version+start', {
    v: { id: 'v', type: 'version', position: { x: 0, y: 0 }, data: { version: '1.0' } },
    s: { id: 's', type: 'start', position: { x: 0, y: 200 }, data: {} },
  }],
  ['version+start+bot', {
    v: { id: 'v', type: 'version', position: { x: 0, y: 0 }, data: { version: '1.0' } },
    b: { id: 'b', type: 'bot', position: { x: 0, y: 50 }, data: { token: 'TEST:token' } },
    s: { id: 's', type: 'start', position: { x: 0, y: 200 }, data: {} },
  }],
]) {
  const doc = createGraphDocument({ nodes, edges: {} });
  const flow = projectGraphToFlow(graphDocumentToProjectGraph(doc));
  const meta = compileGraphToPython(flow, { graphDocument: doc, skipGraphGate: true });
  assert.ok(meta.code.length > 200, `bootstrap bot.py for ${label}`);
  assert.ok(meta.code.includes('Bot(token='), label);
}
console.log('preview-bootstrap.test.mjs: ok');
