/**
 * Persist callback handler repair into canonical GraphDocument.
 */

import { createGraphDocument } from './graph_document.js';
import { graphDocumentToStacks, stacksToGraphDocument } from './stacks_bridge.js';
import { repairCallbackHandlersInStacks } from './repair_callback_handlers.js';
import { createOperation, applyOperation } from './graph_operations.js';
import { logGraphTelemetry } from './graph_telemetry.js';

/**
 * Merge repaired stacks into document (adds missing callback handler nodes/edges).
 * @param {object} document
 * @param {{ persist?: boolean }} [options]
 */
export function repairBrokenCallbacksInDocument(document, options = {}) {
  const beforeStacks = graphDocumentToStacks(document);
  const repaired = repairCallbackHandlersInStacks(beforeStacks);
  if (!repaired.modified) {
    return {
      document: createGraphDocument(document),
      modified: false,
      fixes: [],
      operations: [],
    };
  }

  const beforeNodeIds = new Set(Object.keys(document?.nodes || {}));
  const merged = stacksToGraphDocument(repaired.stacks, {
    viewport: document.viewport,
    ui_state: document.ui_state,
    metadata: document.metadata,
  });

  let doc = createGraphDocument(document);
  const operations = [];

  for (const node of Object.values(merged.nodes)) {
    if (beforeNodeIds.has(node.id)) continue;
    const op = createOperation('AddNode', {
      nodeId: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
      meta: node.meta,
    });
    const result = applyOperation(doc, op);
    if (!result.ok) continue;
    doc = result.document;
    operations.push(op);
  }

  const edgeIds = new Set(Object.keys(doc.edges || {}));
  for (const edge of Object.values(merged.edges)) {
    if (edgeIds.has(edge.id) || edge.invalid) continue;
    const op = createOperation('AddEdge', {
      edgeId: edge.id,
      source: edge.source,
      target: edge.target,
      sourcePort: edge.sourcePort,
      targetPort: edge.targetPort,
      label: edge.label,
      condition: edge.condition,
    });
    const result = applyOperation(doc, op);
    if (!result.ok) continue;
    doc = result.document;
    edgeIds.add(edge.id);
    operations.push(op);
  }

  logGraphTelemetry('callback_repair_persisted', {
    fixCount: repaired.fixes.length,
    newNodes: operations.filter((o) => o.type === 'AddNode').length,
    newEdges: operations.filter((o) => o.type === 'AddEdge').length,
  });

  return {
    document: doc,
    modified: true,
    fixes: repaired.fixes,
    operations,
  };
}

/** @deprecated alias */
export const repairBrokenCallbacks = repairBrokenCallbacksInDocument;
