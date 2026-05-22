import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createGraphDocument } from '../../constructor/graph_document/graph_document.js';
import { resolveUiAttachmentTargetNodeId, graphResolveNodeType } from './graphHelpers.js';

describe('resolveUiAttachmentTargetNodeId', () => {
  it('routes inline from start to downstream message', () => {
    const doc = createGraphDocument({
      nodes: [
        { id: 's', type: 'start', position: { x: 0, y: 0 }, data: {} },
        { id: 'm', type: 'message', position: { x: 0, y: 120 }, data: { text: 'hi' } },
      ],
      edges: [
        {
          id: 'e1',
          source: 's',
          target: 'm',
          sourcePort: 'flow',
          targetPort: 'flow',
        },
      ],
    });
    assert.equal(resolveUiAttachmentTargetNodeId(doc, 's', 'inline'), 'm');
    assert.equal(resolveUiAttachmentTargetNodeId(doc, 'm', 'inline'), 'm');
    assert.equal(graphResolveNodeType(doc.nodes.s), 'start');
  });
});
