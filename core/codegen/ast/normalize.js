/**
 * Graph / Flow → normalized AST nodes { id, type, payload, children, edges }.
 */

import { normalizeFlowNode } from '../../ir/normalizeFlowNode.js';

function byPosition(a, b) {
  const dy = (a.position?.y || 0) - (b.position?.y || 0);
  if (dy !== 0) return dy;
  return (a.position?.x || 0) - (b.position?.x || 0);
}

function topoSortNodes(nodes, edges) {
  const list = nodes || [];
  const idToNode = new Map(list.map((n) => [n.id, n]));
  const adj = new Map();
  const indeg = new Map();
  for (const n of list) {
    adj.set(n.id, []);
    indeg.set(n.id, 0);
  }
  for (const e of edges || []) {
    if (!idToNode.has(e.source) || !idToNode.has(e.target)) continue;
    adj.get(e.source).push(e.target);
    indeg.set(e.target, indeg.get(e.target) + 1);
  }
  const ready = list.filter((n) => indeg.get(n.id) === 0);
  ready.sort(byPosition);
  const out = [];
  while (ready.length) {
    const cur = ready.shift();
    out.push(cur);
    for (const t of adj.get(cur.id) || []) {
      indeg.set(t, indeg.get(t) - 1);
      if (indeg.get(t) === 0) {
        ready.push(idToNode.get(t));
        ready.sort(byPosition);
      }
    }
  }
  if (out.length < list.length) {
    const seen = new Set(out.map((x) => x.id));
    out.push(...list.filter((x) => !seen.has(x.id)).sort(byPosition));
  }
  return out;
}

/**
 * @param {object} flow — React Flow { nodes, edges }
 * @returns {{ nodes: object[], edges: object[] }}
 */
export function normalizeGraphFlow(flow) {
  const nodes = (flow?.nodes || []).map((n) => {
    const norm = normalizeFlowNode(n);
    return {
      id: String(n.id),
      type: norm.type,
      payload: { ...norm.props },
      position: n.position,
    };
  });
  const edges = (flow?.edges || []).map((e) => ({
    id: String(e.id || `${e.source}_${e.target}`),
    source: String(e.source),
    target: String(e.target),
    sourcePort: e.sourcePort || e.sourceHandle || 'flow',
    targetPort: e.targetPort || e.targetHandle || 'flow',
    label: String(e.label || ''),
    condition: String(e.condition || ''),
  }));
  return { nodes, edges };
}

/**
 * Build forest of AST trees from flow edges (flow port only).
 * @param {object} flow
 * @returns {object[]}
 */
export function graphToNormalizedAst(flow) {
  const { nodes, edges } = normalizeGraphFlow(flow);
  const idToNode = new Map(nodes.map((n) => [n.id, { ...n, children: [], edges: [] }]));
  const flowEdges = edges.filter((e) => (e.sourcePort || 'flow') === 'flow');
  const childrenByParent = new Map();
  const hasParent = new Set();

  for (const e of flowEdges) {
    if (!idToNode.has(e.source) || !idToNode.has(e.target)) continue;
    if (!childrenByParent.has(e.source)) childrenByParent.set(e.source, []);
    childrenByParent.get(e.source).push(e.target);
    hasParent.add(e.target);
    const parent = idToNode.get(e.source);
    const child = idToNode.get(e.target);
    parent.children.push(child);
    parent.edges.push(e);
  }

  const roots = nodes
    .filter((n) => !hasParent.has(n.id))
    .map((n) => idToNode.get(n.id))
    .filter(Boolean);

  if (!roots.length && nodes.length) {
    const ordered = topoSortNodes(flow?.nodes || [], flow?.edges || []);
    return ordered.map((n) => idToNode.get(n.id)).filter(Boolean);
  }
  return roots;
}
