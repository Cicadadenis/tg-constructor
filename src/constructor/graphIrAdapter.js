/**
 * GraphIRAdapter — UI-only structural authoring (Graph IR).
 * No execution, no NativeOps, no runtime.
 */

import { assertUiImportAllowed } from './uiLayerGuard.js';

assertUiImportAllowed('constructor/graphIrAdapter');

function cloneGraph(g) {
  return JSON.parse(JSON.stringify(g ?? {}));
}

export function createEmptyGraphIR() {
  return {
    schema_version: 2,
    name: 'bot',
    config: {},
    globals: {},
    nodes: {},
    edges: [],
    handlers: [],
    scenarios: {},
    blocks: {},
  };
}

export class GraphIRAdapter {
  constructor(graph) {
    this._graph = cloneGraph(graph ?? createEmptyGraphIR());
  }

  get graph() {
    return this._graph;
  }

  toJSON() {
    return cloneGraph(this._graph);
  }

  createNode(nodeId, op, { payload = {}, meta = {} } = {}) {
    if (this._graph.nodes[nodeId]) {
      throw new Error(`node already exists: ${nodeId}`);
    }
    this._graph.nodes[nodeId] = { id: nodeId, op, payload, meta };
    return this._graph.nodes[nodeId];
  }

  updateNode(nodeId, { op, payload, meta } = {}) {
    const node = this._graph.nodes[nodeId];
    if (!node) throw new Error(`unknown node: ${nodeId}`);
    if (op != null) node.op = op;
    if (payload != null) node.payload = payload;
    if (meta != null) node.meta = meta;
    return node;
  }

  deleteNode(nodeId) {
    if (!this._graph.nodes[nodeId]) throw new Error(`unknown node: ${nodeId}`);
    delete this._graph.nodes[nodeId];
    this._graph.edges = (this._graph.edges || []).filter(
      (e) => e.source !== nodeId && e.target !== nodeId,
    );
  }

  createEdge(edgeId, source, target, { kind = 'next', condition = null } = {}) {
    if (!this._graph.nodes[source] || !this._graph.nodes[target]) {
      throw new Error('edge endpoints must exist');
    }
    const edge = { id: edgeId, source, target, kind, condition };
    this._graph.edges.push(edge);
    return edge;
  }

  /** Structural validation only — no semantics, no execution. */
  validateStructureOnly() {
    const issues = [];
    const nodes = this._graph.nodes || {};
    const nodeIds = new Set(Object.keys(nodes));
    for (const e of this._graph.edges || []) {
      if (!nodeIds.has(e.source)) issues.push(`edge ${e.id}: missing source ${e.source}`);
      if (!nodeIds.has(e.target)) issues.push(`edge ${e.id}: missing target ${e.target}`);
    }
    for (const h of this._graph.handlers || []) {
      if (h.entry_node && !nodeIds.has(h.entry_node)) {
        issues.push(`handler: unknown entry_node ${h.entry_node}`);
      }
    }
    return issues;
  }
}
