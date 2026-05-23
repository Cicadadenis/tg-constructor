import test from 'node:test';
import assert from 'node:assert/strict';
import { isPointerClickNotDrag, NODE_CLICK_DRAG_THRESHOLD_PX, getCicadaNodeLayout } from './graph_canvas_metrics.js';
import {
  getNodeDeleteSummary,
  collectDownstreamFlowChain,
  removeGraphNodes,
  duplicateGraphNode,
  getIncidentEdges,
} from './graph_node_delete.js';
import { createGraphDocument } from '../constructor/graph_document/graph_document.js';

test('click vs drag threshold', () => {
  assert.equal(isPointerClickNotDrag(0, 0), true);
  assert.equal(isPointerClickNotDrag(3, 3), true);
  assert.equal(isPointerClickNotDrag(6, 0), false);
  assert.equal(NODE_CLICK_DRAG_THRESHOLD_PX, 5);
});

test('hit area larger than puzzle body', () => {
  const layout = getCicadaNodeLayout('message', false);
  assert.ok(layout.hitW > layout.width);
  assert.ok(layout.hitH > layout.height);
});

test('delete summary for connected node', () => {
  const doc = createGraphDocument({
    nodes: {
      a: { id: 'a', type: 'message', position: { x: 0, y: 0 }, data: { text: 'A' } },
      b: { id: 'b', type: 'message', position: { x: 0, y: 80 }, data: { text: 'B' } },
    },
    edges: {
      e1: { id: 'e1', source: 'a', target: 'b', sourcePort: 'flow', targetPort: 'flow' },
    },
  });
  const summary = getNodeDeleteSummary(doc, 'a');
  assert.equal(summary.edgeCount, 1);
  assert.equal(summary.needsConfirm, true);
  assert.deepEqual(summary.downstreamChain, ['b']);
});

test('remove node repairs dangling edges', () => {
  const doc = createGraphDocument({
    nodes: {
      a: { id: 'a', type: 'message', position: { x: 0, y: 0 }, data: {} },
      b: { id: 'b', type: 'message', position: { x: 0, y: 80 }, data: {} },
    },
    edges: {
      e1: { id: 'e1', source: 'a', target: 'b', sourcePort: 'flow', targetPort: 'flow' },
    },
  });
  const out = removeGraphNodes(doc, ['a']);
  assert.equal(out.ok, true);
  assert.equal(out.document.nodes.a, undefined);
  assert.equal(Object.keys(out.document.edges).length, 0);
});

test('collect downstream flow chain', () => {
  const doc = createGraphDocument({
    nodes: {
      s: { id: 's', type: 'start', position: { x: 0, y: 0 } },
      m: { id: 'm', type: 'message', position: { x: 0, y: 80 }, data: {} },
      k: { id: 'k', type: 'inline_keyboard', position: { x: 0, y: 120 }, data: {} },
    },
    edges: {
      e1: { id: 'e1', source: 's', target: 'm', sourcePort: 'flow', targetPort: 'flow' },
      ek: { id: 'ek', source: 'm', target: 'k', sourcePort: 'keyboard', targetPort: 'keyboard' },
    },
  });
  assert.deepEqual(collectDownstreamFlowChain(doc, 's'), ['m']);
  assert.deepEqual(collectDownstreamFlowChain(doc, 'm'), []);
});

test('duplicate node creates new id', () => {
  const doc = createGraphDocument({
    nodes: {
      m: { id: 'm', type: 'message', position: { x: 10, y: 20 }, data: { text: 'Hi' } },
    },
    edges: {},
  });
  const out = duplicateGraphNode(doc, 'm');
  assert.equal(out.ok, true);
  assert.ok(out.newNodeId);
  assert.notEqual(out.newNodeId, 'm');
  assert.equal(out.document.nodes[out.newNodeId].data.text, 'Hi');
});

test('isolated node delete needs no confirm', () => {
  const doc = createGraphDocument({
    nodes: { m: { id: 'm', type: 'message', position: { x: 0, y: 0 }, data: {} } },
    edges: {},
  });
  const summary = getNodeDeleteSummary(doc, 'm');
  assert.equal(summary.needsConfirm, false);
  assert.equal(getIncidentEdges(doc, 'm').length, 0);
});
