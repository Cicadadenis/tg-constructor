import test from 'node:test';
import assert from 'node:assert/strict';
import { createGraphDocument } from '../../constructor/graph_document/graph_document.js';
import {
  computeFlowBuilderPositions,
  findLayoutRoots,
  getOutgoingLayoutEdges,
} from './flowBuilderLayout.js';

test('findLayoutRoots picks nodes without incoming flow', () => {
  const doc = createGraphDocument({
    nodes: {
      s: { id: 's', type: 'start', position: { x: 0, y: 0 }, data: {} },
      m: { id: 'm', type: 'message', position: { x: 0, y: 80 }, data: {} },
    },
    edges: {
      e1: { id: 'e1', source: 's', target: 'm', sourcePort: 'flow', targetPort: 'flow' },
    },
  });
  const roots = findLayoutRoots(doc);
  assert.equal(roots.length, 1);
  assert.equal(roots[0].id, 's');
});

test('vertical chain: child centered under parent', () => {
  const doc = createGraphDocument({
    nodes: {
      a: { id: 'a', type: 'message', position: { x: 400, y: 50 }, data: { text: 'A' } },
      b: { id: 'b', type: 'message', position: { x: 10, y: 300 }, data: { text: 'B' } },
    },
    edges: {
      e1: { id: 'e1', source: 'a', target: 'b', sourcePort: 'flow', targetPort: 'flow' },
    },
  });
  const { positions } = computeFlowBuilderPositions(doc, 'AUTO');
  const pa = positions.get('a');
  const pb = positions.get('b');
  assert.ok(pa && pb);
  assert.ok(pb.y > pa.y);
  const aCenter = pa.x + 134;
  const bCenter = pb.x + 134;
  assert.ok(Math.abs(aCenter - bCenter) < 4, `expected aligned centers, got ${aCenter} vs ${bCenter}`);
});

test('condition branches layout horizontally under parent', () => {
  const doc = createGraphDocument({
    nodes: {
      c: { id: 'c', type: 'condition', position: { x: 0, y: 0 }, data: { cond: 'x' } },
      t: { id: 't', type: 'message', position: { x: 0, y: 0 }, data: {} },
      f: { id: 'f', type: 'message', position: { x: 0, y: 0 }, data: {} },
    },
    edges: {
      et: { id: 'et', source: 'c', target: 't', sourcePort: 'true', targetPort: 'flow' },
      ef: { id: 'ef', source: 'c', target: 'f', sourcePort: 'false', targetPort: 'flow' },
    },
  });
  assert.equal(getOutgoingLayoutEdges(doc, 'c').length, 2);
  const { positions } = computeFlowBuilderPositions(doc, 'AUTO');
  const pc = positions.get('c');
  const pt = positions.get('t');
  const pf = positions.get('f');
  assert.ok(pc && pt && pf);
  assert.ok(pt.x < pf.x, 'TRUE branch should be left of FALSE');
  assert.ok(pt.y === pf.y, 'branches share same row');
  assert.ok(pt.y > pc.y);
});

test('COMPACT mode uses tighter vertical spacing than EXPANDED', () => {
  const seed = {
    nodes: {
      a: { id: 'a', type: 'message', position: { x: 0, y: 0 }, data: {} },
      b: { id: 'b', type: 'message', position: { x: 0, y: 0 }, data: {} },
    },
    edges: {
      e1: { id: 'e1', source: 'a', target: 'b', sourcePort: 'flow', targetPort: 'flow' },
    },
  };
  const compact = computeFlowBuilderPositions(createGraphDocument(seed), 'COMPACT');
  const expanded = computeFlowBuilderPositions(createGraphDocument(seed), 'EXPANDED');
  const dyCompact = compact.positions.get('b').y - compact.positions.get('a').y;
  const dyExpanded = expanded.positions.get('b').y - expanded.positions.get('a').y;
  assert.ok(dyExpanded > dyCompact);
});
