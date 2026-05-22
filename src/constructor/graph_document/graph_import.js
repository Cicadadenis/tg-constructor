/**
 * Bootstrap operation builders — used by graph_migration.js only at load/import.
 */

import { createGraphDocument } from './graph_document.js';
import { createOperation } from './graph_operations.js';

export function documentToBootstrapOperations(document) {
  const doc = createGraphDocument(document);
  const ops = [];
  const nodeIds = Object.keys(doc.nodes).sort();
  for (const nodeId of nodeIds) {
    const node = doc.nodes[nodeId];
    ops.push(createOperation('AddNode', {
      nodeId,
      type: node.type,
      position: { ...node.position },
      data: { ...node.data },
      meta: { ...node.meta },
    }));
  }
  const edgeIds = Object.keys(doc.edges).sort();
  for (const edgeId of edgeIds) {
    const edge = doc.edges[edgeId];
    ops.push(createOperation('AddEdge', {
      edgeId,
      source: edge.source,
      target: edge.target,
      sourcePort: edge.sourcePort,
      targetPort: edge.targetPort,
      label: edge.label,
      condition: edge.condition,
    }));
  }
  return ops;
}

