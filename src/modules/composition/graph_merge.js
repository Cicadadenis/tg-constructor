/**
 * Graph merge engine — remaps IDs, dedupes bot/start, offsets fragments.
 */

import { createGraphDocument } from '../../constructor/graph_document/graph_document.js';
import { MODULE_COL_WIDTH } from '../graph/helpers.js';
import { namespaceModuleCallbacks, detectCallbackCollisions } from './callback_namespace.js';
import { mergeGlobals } from './globals_merge.js';

const SYSTEM_TYPES = new Set(['bot', 'start']);

/**
 * @param {object[]} nodes
 * @param {object[]} edges
 */
export function seedToNodeMap(nodes, edges) {
  const nodeMap = {};
  for (const n of nodes || []) {
    const id = String(n.id || '');
    if (!id) continue;
    nodeMap[id] = {
      id,
      type: n.type === 'cicada' ? String(n.data?.type || 'message') : String(n.type || 'message'),
      position: { ...(n.position || { x: 0, y: 0 }) },
      data: n.data?.props ? { ...n.data.props } : { ...(n.data || {}) },
      meta: { ...(n.meta || {}) },
    };
  }
  const edgeMap = {};
  for (const e of edges || []) {
    const id = String(e.id || `edge_${e.source}_${e.target}`);
    if (!e.source || !e.target) continue;
    edgeMap[id] = {
      id,
      source: e.source,
      target: e.target,
      sourcePort: e.sourcePort || e.sourceHandle || 'flow',
      targetPort: e.targetPort || e.targetHandle || 'flow',
      label: e.label,
      condition: e.condition,
    };
  }
  return { nodes: nodeMap, edges: edgeMap };
}

/**
 * @param {Record<string, object>} nodes
 * @param {string} prefix
 */
export function remapNodeIds(nodes, prefix) {
  const idMap = {};
  for (const id of Object.keys(nodes)) {
    idMap[id] = `${prefix}${id}`;
  }
  const out = {};
  for (const [oldId, node] of Object.entries(nodes)) {
    out[idMap[oldId]] = { ...node, id: idMap[oldId] };
  }
  return { nodes: out, idMap };
}

/**
 * @param {Record<string, object>} edges
 * @param {Record<string, string>} idMap
 */
export function remapEdgeIds(edges, idMap) {
  const out = {};
  for (const edge of Object.values(edges || {})) {
    const source = idMap[edge.source];
    const target = idMap[edge.target];
    if (!source || !target) continue;
    const id = `edge_${source}_${target}`;
    out[id] = {
      ...edge,
      id,
      source,
      target,
    };
  }
  return out;
}

/**
 * @param {Record<string, object>} nodes
 * @param {number} offsetX
 * @param {number} [offsetY]
 */
export function offsetNodePositions(nodes, offsetX, offsetY = 0) {
  const out = {};
  for (const [id, node] of Object.entries(nodes)) {
    out[id] = {
      ...node,
      position: {
        x: (Number(node.position?.x) || 0) + offsetX,
        y: (Number(node.position?.y) || 0) + offsetY,
      },
    };
  }
  return out;
}

/**
 * @param {Record<string, object>} nodes
 * @param {Set<string>} types
 */
export function filterNodesByType(nodes, types) {
  const drop = new Set();
  for (const [id, node] of Object.entries(nodes)) {
    if (types.has(node.type)) drop.add(id);
  }
  const out = {};
  for (const [id, node] of Object.entries(nodes)) {
    if (!drop.has(id)) out[id] = node;
  }
  return { nodes: out, droppedIds: drop };
}

/**
 * @param {Record<string, object>} edges
 * @param {Set<string>} droppedNodeIds
 */
export function filterEdgesForNodes(edges, droppedNodeIds) {
  const out = {};
  for (const edge of Object.values(edges || {})) {
    if (droppedNodeIds.has(edge.source) || droppedNodeIds.has(edge.target)) continue;
    out[edge.id] = edge;
  }
  return out;
}

/**
 * @param {import('./types.js').GraphModuleManifest} manifest
 * @param {string} idPrefix
 */
export function manifestToFragment(manifest, idPrefix) {
  const { nodes: rawNodes, edges: rawEdges } = manifest.graph || { nodes: [], edges: [] };
  let { nodes, edges } = seedToNodeMap(rawNodes, rawEdges);
  const remap = remapNodeIds(nodes, idPrefix);
  nodes = remap.nodes;
  edges = remapEdgeIds(edges, remap.idMap);

  const namespaced = namespaceModuleCallbacks(nodes, manifest.id);
  nodes = namespaced.nodes;

  return {
    nodes,
    edges,
    callbackRemap: namespaced.remapMap,
    callbackCollisions: namespaced.collisions,
  };
}

/**
 * Merge fragment into base GraphDocument seed.
 * @param {object|null} baseSeed — { nodes, edges } or null
 * @param {import('./types.js').GraphModuleManifest} manifest
 * @param {object} [options]
 */
export function mergeGraphFragment(baseSeed, manifest, options = {}) {
  const idPrefix = `m_${manifest.id}_`;
  const fragment = manifestToFragment(manifest, idPrefix);
  const strategy = manifest.mergeStrategy || {};
  const fixes = [];
  const conflicts = [...(fragment.callbackCollisions || [])];

  let baseNodes = {};
  let baseEdges = {};
  if (baseSeed) {
    const base = seedToNodeMap(baseSeed.nodes || [], baseSeed.edges || []);
    baseNodes = base.nodes;
    baseEdges = base.edges;
  }

  let incomingNodes = fragment.nodes;
  let incomingEdges = fragment.edges;

  const baseHasBot = Object.values(baseNodes).some((n) => n.type === 'bot');
  const baseHasStart = Object.values(baseNodes).some((n) => n.type === 'start');

  if (strategy.dedupeBot !== false && baseHasBot) {
    const filtered = filterNodesByType(incomingNodes, new Set(['bot']));
    incomingNodes = filtered.nodes;
    incomingEdges = filterEdgesForNodes(incomingEdges, filtered.droppedIds);
    if (filtered.droppedIds.size) {
      fixes.push({ kind: 'dedupe_bot', message: `Dropped duplicate bot from ${manifest.id}` });
    }
  }

  if (strategy.dedupeStart !== false && baseHasStart) {
    const filtered = filterNodesByType(incomingNodes, new Set(['start']));
    incomingNodes = filtered.nodes;
    incomingEdges = filterEdgesForNodes(incomingEdges, filtered.droppedIds);
    if (filtered.droppedIds.size) {
      fixes.push({ kind: 'dedupe_start', message: `Dropped duplicate start from ${manifest.id}` });
    }
  }

  const globalMerge = mergeGlobals(
    baseNodes,
    incomingNodes,
    strategy.mergeGlobals || 'first_wins',
  );
  incomingNodes = globalMerge.nodes;
  conflicts.push(...globalMerge.conflicts);
  fixes.push(...globalMerge.fixes);

  conflicts.push(...detectCallbackCollisions(baseNodes, incomingNodes));

  const maxX = Object.values(baseNodes).reduce(
    (m, n) => Math.max(m, Number(n.position?.x) || 0),
    0,
  );
  const offsetX = strategy.placement === 'foundation' || !Object.keys(baseNodes).length
    ? 0
    : maxX + MODULE_COL_WIDTH;

  incomingNodes = offsetNodePositions(incomingNodes, offsetX);

  const mergedNodes = { ...baseNodes, ...incomingNodes };
  const mergedEdges = { ...baseEdges, ...incomingEdges };

  return {
    seed: {
      nodes: Object.values(mergedNodes),
      edges: Object.values(mergedEdges),
    },
    conflicts,
    fixes,
    callbackRemap: fragment.callbackRemap,
  };
}

/**
 * @param {object[]} nodeList
 * @param {object[]} edgeList
 */
export function graphSeedToDocument(nodeList, edgeList) {
  return createGraphDocument({
    schema_version: 1,
    nodes: nodeList,
    edges: edgeList,
    metadata: { name: 'composed-modules', revision: 0 },
  });
}

/**
 * @param {object|null} baseDocument
 * @param {import('./types.js').GraphModuleManifest[]} manifests
 */
export function mergeGraphs(baseDocument, manifests) {
  let seed = baseDocument
    ? {
        nodes: Object.values(baseDocument.nodes || {}),
        edges: Object.values(baseDocument.edges || {}),
      }
    : null;

  const allConflicts = [];
  const allFixes = [];
  const callbackRemaps = {};

  for (const manifest of manifests) {
    const merged = mergeGraphFragment(seed, manifest);
    seed = merged.seed;
    allConflicts.push(...merged.conflicts);
    allFixes.push(...merged.fixes);
    Object.assign(callbackRemaps, merged.callbackRemap || {});
  }

  const document = graphSeedToDocument(seed.nodes, seed.edges);
  return {
    document,
    conflicts: allConflicts,
    fixes: allFixes,
    callbackRemaps,
  };
}
