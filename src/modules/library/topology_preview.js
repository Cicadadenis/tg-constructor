/**
 * Graph topology summary for module library preview.
 */

import { isGraphKeyboardNode } from '../../../core/keyboard_topology.js';

/**
 * @param {import('../../constructor/graph_document/graph_document.js').GraphDocument} document
 */
export function analyzeGraphTopology(document) {
  const nodes = Object.values(document?.nodes || {});
  const edges = Object.values(document?.edges || {});

  const byType = {};
  for (const n of nodes) {
    byType[n.type] = (byType[n.type] || 0) + 1;
  }

  const callbacks = nodes
    .filter((n) => n.type === 'callback')
    .map((n) => ({
      nodeId: n.id,
      data: String(n.data?.data || n.data?.label || '').trim(),
      label: String(n.data?.label || '').trim(),
    }));

  const globals = nodes
    .filter((n) => n.type === 'global' || n.type === 'set_global')
    .map((n) => String(n.data?.varname || n.data?.key || '').trim())
    .filter(Boolean);

  const handlers = callbacks.length;
  const keyboardNodes = nodes.filter((n) => isGraphKeyboardNode(n.type)).length;
  const legacyInline = nodes.filter((n) => n.type === 'inline' || n.type === 'buttons').length;

  const entryRoots = nodes.filter((n) => n.type === 'start' || n.type === 'command').length;

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    byType,
    callbacks,
    callbackCount: callbacks.length,
    globals,
    globalCount: globals.length,
    handlers,
    keyboardNodes,
    legacyKeyboardBlocks: legacyInline,
    entryRoots,
    routes: callbacks.map((c) => c.data).filter(Boolean),
    states: nodes.filter((n) => ['ask', 'remember', 'save', 'get'].includes(n.type)).length,
  };
}

/**
 * @param {import('./topology_preview.js').ReturnType<typeof analyzeGraphTopology>} topology
 * @param {'ru'|'en'} [lang]
 */
export function formatTopologySummary(topology, lang = 'ru') {
  if (!topology) return '';
  if (lang === 'en') {
    return [
      `${topology.nodeCount} nodes · ${topology.edgeCount} edges`,
      `${topology.callbackCount} callbacks · ${topology.globalCount} globals`,
      topology.keyboardNodes ? `${topology.keyboardNodes} keyboard nodes` : null,
    ].filter(Boolean).join('\n');
  }
  return [
    `${topology.nodeCount} узлов · ${topology.edgeCount} связей`,
    `${topology.callbackCount} callback · ${topology.globalCount} глобальных`,
    topology.keyboardNodes ? `${topology.keyboardNodes} клавиатур` : null,
  ].filter(Boolean).join('\n');
}
