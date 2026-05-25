import assert from 'node:assert/strict';
import test from 'node:test';

import '../node_manifest/init.mjs';
import {
  getNodeManifestRegistry,
  NodeManifestRegistryModificationError,
  validateNodeExecution,
  NodeManifestValidationError,
} from '../node_manifest/index.mjs';
import { blockDefinitions } from '../blockRegistry.js';
import { hasOperationContract } from '../../src/constructor/graph_document/operation_registry.js';

test('every blockDefinitions type has NodeManifest', () => {
  const registry = getNodeManifestRegistry();
  assert.equal(registry.size, blockDefinitions.length);
  for (const def of blockDefinitions) {
    assert.ok(registry.has(def.type), `missing manifest for ${def.type}`);
    const m = registry.get(def.type);
    assert.equal(m.type, def.type);
    assert.ok(m.inputs.schema);
    assert.ok(Array.isArray(m.outputs.ports));
    assert.ok(m.capabilities.length > 0);
    assert.equal(typeof m.executionContract.async, 'boolean');
    assert.equal(typeof m.executionContract.idempotent, 'boolean');
  }
});

test('registry is sealed after boot', () => {
  const registry = getNodeManifestRegistry();
  assert.throws(
    () => registry.register('x', {}),
    NodeManifestRegistryModificationError,
  );
});

test('hasOperationContract delegates to NodeManifestRegistry', () => {
  assert.equal(hasOperationContract('message'), true);
  assert.equal(hasOperationContract('not_real_type_xyz'), false);
});

test('validateNodeExecution rejects unknown type', () => {
  assert.throws(
    () => validateNodeExecution('not_real_type_xyz', { text: 'hi' }),
    NodeManifestValidationError,
  );
});

test('validateNodeExecution enforces payload rules', () => {
  assert.throws(
    () => validateNodeExecution('message', { props: { text: '' } }),
    NodeManifestValidationError,
  );
  const manifest = validateNodeExecution('message', { props: { text: 'hello' } });
  assert.equal(manifest.type, 'message');
});
