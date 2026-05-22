/**
 * GraphDocumentValidator — structural validation only (no execution semantics).
 */

import { createGraphDocument } from './graph_document.js';
import { isGraphDocumentShape } from './graph_schema.js';

function buildAdjacency(edges) {
  const out = new Map();
  const inc = new Map();
  for (const edge of Object.values(edges || {})) {
    if (!out.has(edge.source)) out.set(edge.source, []);
    out.get(edge.source).push(edge);
    if (!inc.has(edge.target)) inc.set(edge.target, []);
    inc.get(edge.target).push(edge);
  }
  return { out, inc };
}

function detectCycles(nodes, edges) {
  const { out } = buildAdjacency(edges);
  const cycles = [];
  const visited = new Set();
  const stack = new Set();
  const path = [];

  function dfs(nodeId) {
    if (stack.has(nodeId)) {
      const start = path.indexOf(nodeId);
      cycles.push(path.slice(start).concat(nodeId));
      return;
    }
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    stack.add(nodeId);
    path.push(nodeId);
    for (const edge of out.get(nodeId) || []) {
      dfs(edge.target);
    }
    path.pop();
    stack.delete(nodeId);
  }

  for (const nodeId of Object.keys(nodes || {})) {
    dfs(nodeId);
  }
  return cycles;
}

export class GraphDocumentValidator {
  constructor(options = {}) {
    this.allowCycles = options.allowCycles === true;
  }

  validate(document) {
    const issues = [];
    if (!isGraphDocumentShape(document)) {
      return {
        ok: false,
        issues: [{ code: 'invalid_document', message: 'Value is not a GraphDocument' }],
      };
    }

    const doc = createGraphDocument(document);
    const nodeIds = new Set(Object.keys(doc.nodes));

    if (doc.schema_version < 1) {
      issues.push({
        code: 'schema_version',
        message: `Unsupported schema_version: ${doc.schema_version}`,
      });
    }

    for (const edge of Object.values(doc.edges)) {
      if (!nodeIds.has(edge.source)) {
        issues.push({
          code: 'invalid_edge',
          edgeId: edge.id,
          message: `Edge ${edge.id} missing source node ${edge.source}`,
        });
      }
      if (!nodeIds.has(edge.target)) {
        issues.push({
          code: 'invalid_edge',
          edgeId: edge.id,
          message: `Edge ${edge.id} missing target node ${edge.target}`,
        });
      }
      if (edge.source === edge.target) {
        issues.push({
          code: 'self_loop',
          edgeId: edge.id,
          message: `Edge ${edge.id} is a self-loop`,
        });
      }
    }

    const { out, inc } = buildAdjacency(doc.edges);
    for (const nodeId of nodeIds) {
      const hasIn = (inc.get(nodeId) || []).length > 0;
      const hasOut = (out.get(nodeId) || []).length > 0;
      if (!hasIn && !hasOut && nodeIds.size > 1) {
        issues.push({
          code: 'orphan_node',
          nodeId,
          message: `Node ${nodeId} has no connections`,
        });
      }
    }

    for (const group of doc.ui_state.groups || []) {
      for (const nodeId of group.nodeIds) {
        if (!nodeIds.has(nodeId)) {
          issues.push({
            code: 'invalid_group',
            groupId: group.id,
            message: `Group ${group.id} references unknown node ${nodeId}`,
          });
        }
      }
    }

    const cycles = detectCycles(doc.nodes, doc.edges);
    if (cycles.length && !this.allowCycles) {
      for (const cycle of cycles) {
        issues.push({
          code: 'cycle',
          message: `Structural cycle detected: ${cycle.join(' -> ')}`,
          nodes: cycle,
        });
      }
    }

    return { ok: issues.length === 0, issues };
  }
}

export function validateGraphDocument(document, options) {
  return new GraphDocumentValidator(options).validate(document);
}
