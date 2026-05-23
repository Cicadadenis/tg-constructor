/**
 * GraphDocument → platform Graph IR (structural export for EngineClient).
 */

import { GraphIRAdapter, createEmptyGraphIR } from '../graphIrAdapter.js';
import { graphDocumentToProjectGraph } from './graph_project_bridge.js';
import { strictCompileValidation } from './graph_validation_pipeline.js';

/** Map block type to IR op name (authoring convention only). */
const BLOCK_TYPE_TO_OP = {
  start: 'HandlerEntry',
  message: 'SendMessage',
  buttons: 'SendButtons',
  ask: 'Ask',
  stop: 'Stop',
  noop: 'Noop',
};

function opForBlockType(type) {
  return BLOCK_TYPE_TO_OP[type] || type || 'Noop';
}

export function graphDocumentToGraphIR(document, options = {}) {
  if (options.skipValidation !== true) {
    const gate = strictCompileValidation(document, options);
    if (!gate.ok) {
      const msg = gate.blocking?.[0]?.message || 'Graph IR export blocked by structural validation';
      const err = new Error(msg);
      err.code = 'GRAPH_IR_VALIDATION';
      err.compileDiagnostics = gate.compileDiagnostics;
      throw err;
    }
  }
  const project = graphDocumentToProjectGraph(document);
  const adapter = new GraphIRAdapter(createEmptyGraphIR());
  const graph = adapter.graph;

  for (const node of Object.values(project.nodes)) {
    adapter.createNode(node.id, opForBlockType(node.type), {
      payload: node.props || {},
      meta: node.meta || {},
    });
  }
  for (const edge of Object.values(project.edges)) {
    adapter.createEdge(edge.id, edge.source, edge.target, {
      kind: edge.kind || 'next',
      condition: edge.condition || null,
    });
  }
  return adapter.toJSON();
}
