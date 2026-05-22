import test from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLE_GRAPH_FLOWS } from '../../src/exampleGraphFlows.js';
import { createGraphDocument } from '../../src/constructor/graph_document/graph_document.js';
import { validateGraph } from '../../src/constructor/graph_document/validate_graph.js';

test('all bundled examples pass graph validation', () => {
  for (const [name, flow] of Object.entries(EXAMPLE_GRAPH_FLOWS)) {
    const doc = createGraphDocument({
      nodes: flow.nodes || [],
      edges: flow.edges || [],
    });
    const result = validateGraph(doc, { context: 'example' });
    assert.equal(result.ok, true, `${name}: ${JSON.stringify(result.issues)}`);
  }
});
