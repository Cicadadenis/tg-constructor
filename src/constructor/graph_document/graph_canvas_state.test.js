import assert from 'node:assert/strict';
import { createGraphDocument } from './graph_document.js';
import {
  isGraphBrokenShell,
  isGraphEffectivelyEmpty,
  shouldAutoClearCorruptedGraph,
} from './graph_canvas_state.js';
import { compileGraphToPython } from '../../../core/codegen/pipeline.js';
import { graphDocumentToProjectGraph } from './graph_project_bridge.js';
import { projectGraphToFlow } from '../../../core/graph/model.js';
import { migrateLegacyGraph } from '../aiogram3Migration.js';

// 28 orphan messages — typical corrupt autosave
{
  const nodes = Array.from({ length: 28 }, (_, i) => ({
    id: `m${i}`,
    type: 'message',
    position: { x: i * 40, y: 0 },
    data: { text: `msg ${i}` },
  }));
  const doc = createGraphDocument({ nodes, edges: [] });
  assert.equal(isGraphBrokenShell(doc), true);
  assert.equal(shouldAutoClearCorruptedGraph(doc), true);
  assert.equal(isGraphEffectivelyEmpty(doc), true);
  const flow = migrateLegacyGraph(projectGraphToFlow(graphDocumentToProjectGraph(doc)));
  const out = compileGraphToPython(flow, { graphDocument: doc, validationStage: 'committed' });
  assert.equal(out.compileErrors?.length || 0, 0, 'broken shell must not flood compile errors');
}

// Valid start → message is not broken
{
  const doc = createGraphDocument({
    nodes: [
      { id: 'st', type: 'start', position: { x: 0, y: 0 } },
      { id: 'm', type: 'message', position: { x: 0, y: 80 }, data: { text: 'hi' } },
    ],
    edges: [{ id: 'e', source: 'st', target: 'm' }],
  });
  assert.equal(isGraphBrokenShell(doc), false);
  assert.equal(isGraphEffectivelyEmpty(doc), false);
}

console.log('graph_canvas_state.test.js OK');
