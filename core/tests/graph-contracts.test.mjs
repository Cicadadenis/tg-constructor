import test from 'node:test';
import assert from 'node:assert/strict';
import { createGraphDocument } from '../../src/constructor/graph_document/graph_document.js';
import { persistCanvasBlob } from '../../src/constructor/graph_document/persist_bridge.js';
import {
  validateGraphDocumentContract,
  validateGraphExportContract,
  validateCodegenContract,
} from '../../src/constructor/graph_document/contracts.js';

test('GraphDocument contracts validate persisted payload', () => {
  const doc = createGraphDocument({
    nodes: [{ id: 'n1', type: 'start', position: { x: 0, y: 0 } }],
    edges: [],
  });
  const contract = validateGraphDocumentContract(doc);
  assert.equal(contract.success, true, contract.error?.message);

  const exported = persistCanvasBlob(doc);
  const exportContract = validateGraphExportContract(exported);
  assert.equal(exportContract.success, true, exportContract.error?.message);
});

test('Codegen contract validates standard snapshot shape', () => {
  const result = validateCodegenContract({
    graph: {},
    generatedPython: '',
    empty: true,
    compileWarnings: [],
    compileErrors: [],
    transpileTrace: [],
  });
  assert.equal(result.success, true, result.error?.message);
});
