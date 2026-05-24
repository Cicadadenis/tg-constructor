/**
 * Deterministic top→bottom flow layout with centered nodes and horizontal branches.
 */

import { createGraphDocument } from '../../constructor/graph_document/graph_document.js';
import { graphResolveNodeType } from '../../constructor/graph_document/graph_node_payload.js';
import { hasIncomingFlowEdge } from '../blockLayout.js';
import { getFlowNodeCardLayout } from '../nodeCard/nodeCardLayout.js';
import {
  DEFAULT_FLOW_LAYOUT_MODE,
  getFlowLayoutSpacing,
  normalizeFlowLayoutMode,
} from './flowLayoutModes.js';

/** Primary flow / branch ports — deterministic sibling order. */
const LAYOUT_OUT_PORT_ORDER = Object.freeze([
  'flow',
  'scenario_flow',
  'true',
  'false',
  'body',
  'done',
]);

/**
 * @param {string} port
 */
function layoutPortSortKey(port) {
  const p = String(port || 'flow');
  const idx = LAYOUT_OUT_PORT_ORDER.indexOf(p);
  return idx >= 0 ? idx : 100 + p.charCodeAt(0);
}

/**
 * Outgoing edges that participate in vertical flow layout (excludes keyboard links).
 * @param {object} doc
 * @param {string} nodeId
 */
export function getOutgoingLayoutEdges(doc, nodeId) {
  return Object.values(doc.edges || {})
    .filter((e) => e.source === nodeId && !e.invalid)
    .filter((e) => e.sourcePort !== 'keyboard' && e.targetPort !== 'keyboard')
    .sort((a, b) => {
      const pa = layoutPortSortKey(a.sourcePort);
      const pb = layoutPortSortKey(b.sourcePort);
      if (pa !== pb) return pa - pb;
      return String(a.id).localeCompare(String(b.id));
    });
}

/**
 * Layout roots: no incoming flow edge; settings blocks first.
 * @param {object} doc
 */
export function findLayoutRoots(doc) {
  const nodes = Object.values(doc.nodes || {});
  const settingsFirst = (type) => {
    const t = String(type || '');
    if (t === 'bot' || t === 'version' || t === 'commands' || t === 'global') return 0;
    if (t === 'start' || t === 'command') return 1;
    return 2;
  };

  return nodes
    .filter((n) => !hasIncomingFlowEdge(doc, n.id))
    .sort((a, b) => {
      const oa = settingsFirst(graphResolveNodeType(a));
      const ob = settingsFirst(graphResolveNodeType(b));
      if (oa !== ob) return oa - ob;
      return a.id.localeCompare(b.id);
    });
}

/**
 * @param {object} node
 * @param {object} doc
 * @param {import('./flowLayoutModes.js').FlowLayoutMode} mode
 */
function nodeDimensions(node, doc, mode) {
  const type = graphResolveNodeType(node);
  const isRoot = !hasIncomingFlowEdge(doc, node.id);
  const card = getFlowNodeCardLayout({ type, isChainRoot: isRoot, bodyLineCount: 2 });
  const spacing = getFlowLayoutSpacing(mode);
  return {
    width: card.hitW,
    height: card.hitH,
    stepY: card.height + spacing.rowGapY,
  };
}

/** @type {Map<string, { width: number, subtreeWidth: number }>} */
let measureCache = new Map();

/**
 * @param {string} nodeId
 * @param {object} doc
 * @param {import('./flowLayoutModes.js').FlowLayoutMode} mode
 * @param {Set<string>} [visiting]
 */
function measureSubtree(nodeId, doc, mode, visiting = new Set()) {
  if (measureCache.has(nodeId)) return measureCache.get(nodeId);

  const node = doc.nodes[nodeId];
  const fallback = { width: 268, subtreeWidth: 268 };

  if (!node) {
    measureCache.set(nodeId, fallback);
    return fallback;
  }

  if (visiting.has(nodeId)) {
    const dim = nodeDimensions(node, doc, mode);
    const cycle = { width: dim.width, subtreeWidth: dim.width };
    measureCache.set(nodeId, cycle);
    return cycle;
  }

  visiting.add(nodeId);
  const dim = nodeDimensions(node, doc, mode);
  const children = getOutgoingLayoutEdges(doc, nodeId);
  const spacing = getFlowLayoutSpacing(mode);

  if (!children.length) {
    const leaf = { width: dim.width, subtreeWidth: dim.width };
    measureCache.set(nodeId, leaf);
    visiting.delete(nodeId);
    return leaf;
  }

  const childMeasures = children.map((e) => measureSubtree(e.target, doc, mode, visiting));
  let childrenTotal = 0;
  childMeasures.forEach((m, i) => {
    childrenTotal += m.subtreeWidth;
    if (i > 0) childrenTotal += spacing.branchGapX;
  });

  const result = {
    width: dim.width,
    subtreeWidth: Math.max(dim.width, childrenTotal),
  };
  measureCache.set(nodeId, result);
  visiting.delete(nodeId);
  return result;
}

/**
 * @param {string} nodeId
 * @param {number} centerX
 * @param {number} topY
 * @param {object} doc
 * @param {import('./flowLayoutModes.js').FlowLayoutMode} mode
 * @param {Map<string, { x: number, y: number }>} positions
 * @param {Set<string>} placed
 * @param {Set<string>} [visiting]
 */
function placeSubtree(nodeId, centerX, topY, doc, mode, positions, placed, visiting = new Set()) {
  if (placed.has(nodeId)) {
    return measureCache.get(nodeId)?.subtreeWidth ?? 268;
  }
  if (visiting.has(nodeId)) return 268;

  const node = doc.nodes[nodeId];
  if (!node) return 268;

  visiting.add(nodeId);
  const dim = nodeDimensions(node, doc, mode);
  const spacing = getFlowLayoutSpacing(mode);

  positions.set(nodeId, {
    x: Math.round(centerX - dim.width / 2),
    y: Math.round(topY),
  });
  placed.add(nodeId);

  const children = getOutgoingLayoutEdges(doc, nodeId);
  if (!children.length) {
    visiting.delete(nodeId);
    return measureCache.get(nodeId)?.subtreeWidth ?? dim.width;
  }

  const childMeasures = children.map((e) => measureSubtree(e.target, doc, mode));
  let totalChildrenWidth = 0;
  childMeasures.forEach((m, i) => {
    totalChildrenWidth += m.subtreeWidth;
    if (i > 0) totalChildrenWidth += spacing.branchGapX;
  });

  const subtreeWidth = Math.max(dim.width, totalChildrenWidth);
  let cursorX = centerX - totalChildrenWidth / 2;
  const childY = topY + dim.stepY;

  for (let i = 0; i < children.length; i += 1) {
    const edge = children[i];
    const cm = childMeasures[i];
    const childCenter = cursorX + cm.subtreeWidth / 2;
    placeSubtree(edge.target, childCenter, childY, doc, mode, positions, placed, visiting);
    cursorX += cm.subtreeWidth + spacing.branchGapX;
  }

  visiting.delete(nodeId);
  return subtreeWidth;
}

/**
 * Compute deterministic node positions for the full graph.
 * @param {object} document
 * @param {string} [modeInput]
 * @returns {{ positions: Map<string, { x: number, y: number }>, mode: import('./flowLayoutModes.js').FlowLayoutMode }}
 */
export function computeFlowBuilderPositions(document, modeInput = DEFAULT_FLOW_LAYOUT_MODE) {
  measureCache = new Map();
  const mode = normalizeFlowLayoutMode(modeInput);
  const doc = createGraphDocument(document);
  const spacing = getFlowLayoutSpacing(mode);
  const positions = new Map();
  const placed = new Set();
  const roots = findLayoutRoots(doc);

  let cursorX = spacing.originX;
  for (const root of roots) {
    const measure = measureSubtree(root.id, doc, mode);
    const centerX = cursorX + measure.subtreeWidth / 2;
    placeSubtree(root.id, centerX, spacing.originY, doc, mode, positions, placed);
    cursorX += measure.subtreeWidth + spacing.rootGapX;
  }

  const sortedOrphans = Object.values(doc.nodes || {})
    .filter((n) => !positions.has(n.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const orphan of sortedOrphans) {
    const measure = measureSubtree(orphan.id, doc, mode);
    const centerX = cursorX + measure.subtreeWidth / 2;
    placeSubtree(orphan.id, centerX, spacing.originY, doc, mode, positions, placed);
    cursorX += measure.subtreeWidth + spacing.rootGapX;
  }

  return { positions, mode };
}
