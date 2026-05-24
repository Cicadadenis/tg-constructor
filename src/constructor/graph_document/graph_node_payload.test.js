import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { blockRegistry } from '../../../core/blockRegistry.js';
import {
  UnknownBlockTypeError,
  assertNodeTypeInRegistry,
  assertRegisteredBlockType,
  blockToNodePayload,
  buildGraphNodeData,
  coerceLegacyBlockType,
  graphResolveNodeType,
  normalizeGraphNodePayload,
  resolveCanonicalNodeType,
  stripTypeFieldsFromData,
} from './graph_node_payload.js';

describe('graph_node_payload', () => {
  it('blockToNodePayload keeps canonical type on node; data holds deprecated cache', () => {
    const payload = blockToNodePayload(
      { id: 'n1', type: 'message', props: { text: 'hi' } },
      { x: 0, y: 0 },
    );
    assert.equal(payload.type, 'message');
    assert.equal(payload.data.text, 'hi');
    assert.equal(payload.data.type, 'message');
    assert.equal(payload.data.blockType, 'message');
    assert.ok(blockRegistry.message);
  });

  it('assertNodeTypeInRegistry throws when type missing from blockRegistry', () => {
    assert.throws(
      () => assertNodeTypeInRegistry({ id: 'x', type: 'not_a_real_block_type_xyz', data: {} }),
      UnknownBlockTypeError,
    );
  });

  it('coerceLegacyBlockType reads deprecated data.type for cicada wrapper only', () => {
    assert.equal(
      coerceLegacyBlockType({ id: 'n', type: 'cicada', data: { type: 'start' } }),
      'start',
    );
  });

  it('coerceLegacyBlockType prefers node.type over deprecated data cache', () => {
    assert.equal(
      coerceLegacyBlockType({ id: 'n', type: 'message', data: { type: 'start' } }),
      'message',
    );
  });

  it('normalizeGraphNodePayload rejects unknown types', () => {
    assert.throws(
      () => normalizeGraphNodePayload({
        nodeId: 'x',
        type: 'not_a_real_block_type_xyz',
        data: {},
      }),
      UnknownBlockTypeError,
    );
  });

  it('buildGraphNodeData attaches deprecated cache mirrors', () => {
    const d = buildGraphNodeData('start', { type: 'wrong', blockType: 'wrong', text: 'x' });
    assert.equal(d.text, 'x');
    assert.equal(d.type, 'start');
    assert.equal(d.blockType, 'start');
  });

  it('graphResolveNodeType uses node.type and asserts registry', () => {
    assert.equal(
      graphResolveNodeType({ id: 's', type: 'start', data: {} }),
      'start',
    );
    assert.equal(
      resolveCanonicalNodeType({ id: 's', type: 'start', data: {} }),
      'start',
    );
  });

  it('assertRegisteredBlockType fails on wrapper without legacy', () => {
    assert.throws(
      () => assertRegisteredBlockType('unknown'),
      UnknownBlockTypeError,
    );
  });

  it('stripTypeFieldsFromData unwraps nested props', () => {
    assert.deepEqual(
      stripTypeFieldsFromData({ type: 'x', props: { text: 'a' } }),
      { text: 'a' },
    );
  });
});
