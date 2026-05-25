import test from 'node:test';
import assert from 'node:assert/strict';
import { createGraphDocument } from '../../constructor/graph_document/graph_document.js';
import {
  planInsertNodeOnEdge,
  applyInsertNodeOnEdgePlan,
  isSplittableFlowEdge,
} from './insertNodeOnEdge.js';

test('isSplittableFlowEdge accepts primary flow edge', () => {
  const doc = createGraphDocument({
    nodes: {
      a: { id: 'a', type: 'message', position: { x: 0, y: 0 }, data: { text: 'A' } },
      b: { id: 'b', type: 'message', position: { x: 0, y: 120 }, data: { text: 'B' } },
    },
    edges: {
      e1: { id: 'e1', source: 'a', target: 'b', sourcePort: 'flow', targetPort: 'flow' },
    },
  });
  assert.equal(isSplittableFlowEdge(doc, doc.edges.e1), true);
});

test('planInsertNodeOnEdge splits edge and reconnects', () => {
  const doc = createGraphDocument({
    nodes: {
      a: { id: 'a', type: 'message', position: { x: 0, y: 0 }, data: { text: 'A' } },
      b: { id: 'b', type: 'message', position: { x: 0, y: 200 }, data: { text: 'B' } },
    },
    edges: {
      e1: { id: 'e1', source: 'a', target: 'b', sourcePort: 'flow', targetPort: 'flow' },
    },
  });

  const plan = planInsertNodeOnEdge(doc, 'e1', 'mid', 'delay', { seconds: '1' });
  assert.equal(plan.ok, true);
  assert.ok(plan.operations?.length >= 4);

  const applied = applyInsertNodeOnEdgePlan(doc, plan.operations);
  assert.equal(applied.ok, true);
  assert.equal(applied.document.nodes.mid?.type, 'delay');
  assert.equal(applied.document.edges.e1, undefined);

  const outFromA = Object.values(applied.document.edges).filter((e) => e.source === 'a');
  const outFromMid = Object.values(applied.document.edges).filter((e) => e.source === 'mid');
  assert.equal(outFromA.length, 1);
  assert.equal(outFromA[0].target, 'mid');
  assert.equal(outFromMid.length, 1);
  assert.equal(outFromMid[0].target, 'b');
});
