import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createGraphDocument } from '../../constructor/graph_document/graph_document.js';
import { resolveFlowInsertAnchorId, resolvePaletteChainParentId } from './graphHelpers.js';

describe('resolveFlowInsertAnchorId', () => {
  it('keeps start as anchor for message', () => {
    const doc = createGraphDocument({
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [],
    });
    assert.equal(resolveFlowInsertAnchorId(doc, 's', 'message'), 's');
  });

  it('redirects bot anchor to lone start node', () => {
    const doc = createGraphDocument({
      nodes: [
        { id: 'b', type: 'bot', position: { x: 0, y: 0 }, data: { token: 't' } },
        { id: 's', type: 'start', position: { x: 0, y: 80 }, data: {} },
      ],
      edges: [],
    });
    assert.equal(resolveFlowInsertAnchorId(doc, 'b', 'message'), 's');
  });

  it('follows bot → start edge when present', () => {
    const doc = createGraphDocument({
      nodes: [
        { id: 'b', type: 'bot', position: { x: 0, y: 0 }, data: { token: 't' } },
        { id: 's', type: 'start', position: { x: 0, y: 80 }, data: {} },
      ],
      edges: [
        { id: 'e1', source: 'b', target: 's', sourcePort: 'flow', targetPort: 'flow' },
      ],
    });
    assert.equal(resolveFlowInsertAnchorId(doc, 'b', 'message'), 's');
  });

  it('returns null for missing anchor id', () => {
    const doc = createGraphDocument({ nodes: [], edges: [] });
    assert.equal(resolveFlowInsertAnchorId(doc, 'ghost', 'message'), null);
    assert.equal(resolvePaletteChainParentId(doc, 'ghost', 'message'), null);
  });
});
