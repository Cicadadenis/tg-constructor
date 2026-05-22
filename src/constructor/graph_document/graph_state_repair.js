/**
 * Graph corruption audit + repair — legacy dangling edges, stale hydration, ghost state.
 */

import { createGraphDocument } from './graph_document.js';
import { createOperation, applyOperation } from './graph_operations.js';
import { listDanglingEdges, repairDanglingEdges } from './graph_edge_repair.js';
import { compositionOp, validateCompositionOperations } from './graph_ui_compositions.js';
import { sanitizeGraphSeed } from './graph_seed_sanitize.js';

export { sanitizeGraphSeed };

/**
 * @param {object} document
 * @returns {{
 *   nodeCount: number,
 *   edgeCount: number,
 *   validEdgeCount: number,
 *   danglingEdges: object[],
 *   orphanNodeIds: string[],
 *   ghostSelectionIds: string[],
 *   staleHydrationCount: number,
 *   canvasMismatch: boolean,
 * }}
 */
export function auditGraphCorruption(document) {
  const doc = createGraphDocument(document);
  const nodes = doc.nodes || {};
  const nodeIds = new Set(Object.keys(nodes));
  const { dangling, valid } = listDanglingEdges(doc);

  const orphanNodeIds = [];
  for (const [id, node] of Object.entries(nodes)) {
    const hasFlow = Object.values(doc.edges || {}).some(
      (e) => !e.invalid && (e.source === id || e.target === id),
    );
    const type = String(node.type || '').trim();
    const isSettings = ['bot', 'version', 'commands', 'global'].includes(type);
    const isEntry = ['start', 'command', 'callback'].includes(type);
    if (!hasFlow && !isSettings && !isEntry && nodeIds.size > 1) {
      orphanNodeIds.push(id);
    }
  }

  const selection = doc.ui_state?.selection || [];
  const ghostSelectionIds = selection.filter((id) => !nodeIds.has(id));

  const staleHydrationCount = Number(doc.metadata?.hydrationDiagnostics?.orphanEdgeCount) || 0;
  const canvasMismatch = dangling.length > 0 || staleHydrationCount > dangling.length;

  return {
    nodeCount: nodeIds.size,
    edgeCount: Object.keys(doc.edges || {}).length,
    validEdgeCount: valid.length,
    danglingEdges: dangling,
    orphanNodeIds,
    ghostSelectionIds,
    staleHydrationCount,
    canvasMismatch,
  };
}

/**
 * @param {object} document
 */
export function purgeInvalidEdgesFromDocument(document) {
  return repairDanglingEdges(document, { mode: 'remove' });
}

/** @param {object} document */
export function compilePurgeInvalidEdges(document) {
  const { operations } = repairDanglingEdges(document, { mode: 'remove' });
  return validateCompositionOperations(operations);
}

/**
 * @param {object} document
 */
export function buildEmptyGraphDocument() {
  return createGraphDocument({
    nodes: [],
    edges: [],
    metadata: { name: 'studio-project', revision: 0, hydrationDiagnostics: null },
    viewport: { x: 0, y: 0, zoom: 1 },
    ui_state: { selection: [], collapsed: [], groups: [] },
  });
}
