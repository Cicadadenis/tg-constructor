/**
 * Callback namespace registry — collision detection and scoped remapping.
 */

const CALLBACK_PATTERN = /(?:^|[\s|,|→])([a-zA-Z][\w:.-]{0,48})/g;

/**
 * @param {string} raw
 * @returns {string[]}
 */
export function extractCallbackTokensFromText(raw) {
  const text = String(raw || '');
  const found = new Set();
  for (const line of text.split('\n')) {
    const parts = line.split(/[→|]/);
    for (const part of parts) {
      const token = part.trim();
      if (/^mod_[\w]+:[\w:-]+$/.test(token)) found.add(token);
      if (/^[\w][\w:-]{0,48}$/.test(token) && token.includes(':')) found.add(token);
    }
  }
  return [...found];
}

/**
 * @param {object} node — GraphDocument node
 * @returns {string[]}
 */
export function collectCallbacksFromNode(node) {
  const type = String(node?.type || node?.data?.type || '');
  const props = node?.data || {};
  const out = new Set();

  if (type === 'callback') {
    const data = String(props.data || props.callbackData || '').trim();
    const prefix = String(props.callbackPrefix || props.dataPrefix || '').trim();
    const label = String(props.label || '').trim();
    if (data) out.add(data);
    if (prefix) out.add(prefix.endsWith(':') ? prefix : `${prefix}:`);
    if (label && label.includes(':')) out.add(label);
  }

  if (type === 'inline' || type === 'buttons') {
    const raw = String(props.buttons || props.rows || '').trim();
    for (const token of extractCallbackTokensFromText(raw)) out.add(token);
  }

  return [...out];
}

/**
 * @param {Record<string, object>} nodes
 * @returns {Map<string, string[]>}
 */
export function buildCallbackRegistry(nodes) {
  const registry = new Map();
  for (const node of Object.values(nodes || {})) {
    for (const cb of collectCallbacksFromNode(node)) {
      const list = registry.get(cb) || [];
      list.push(node.id);
      registry.set(cb, list);
    }
  }
  return registry;
}

/**
 * @param {string} callback
 * @param {string} moduleId
 * @returns {string}
 */
export function scopeCallback(callback, moduleId) {
  const raw = String(callback || '').trim();
  if (!raw) return raw;
  if (raw.startsWith(`mod_${moduleId}:`) || /^mod_[\w]+:/.test(raw)) return raw;
  const slug = String(moduleId || 'mod').replace(/[^a-zA-Z0-9_]/g, '_');
  const short = raw.replace(/[^a-zA-Z0-9_:.-]/g, '_').slice(0, 40);
  return `mod_${slug}:${short}`;
}

/**
 * Remap callback strings inside node props.
 * @param {object} node
 * @param {Record<string, string>} remapMap
 * @returns {object}
 */
export function remapCallbacksInNode(node, remapMap) {
  if (!node || !remapMap || !Object.keys(remapMap).length) return node;
  const type = String(node.type || '');
  const data = { ...(node.data || {}) };

  const replaceInText = (text) => {
    let out = String(text || '');
    for (const [from, to] of Object.entries(remapMap)) {
      if (!from || from === to) continue;
      out = out.split(from).join(to);
    }
    return out;
  };

  if (type === 'callback') {
    if (data.data) data.data = remapMap[data.data] || data.data;
    if (data.callbackData) data.callbackData = remapMap[data.callbackData] || data.callbackData;
    if (data.label && remapMap[data.label]) data.label = remapMap[data.label];
    if (data.callbackPrefix) {
      const p = String(data.callbackPrefix);
      data.callbackPrefix = remapMap[p] || remapMap[`${p}:`] || data.callbackPrefix;
    }
  }

  if (type === 'inline' || type === 'buttons') {
    if (data.buttons) data.buttons = replaceInText(data.buttons);
    if (data.rows) data.rows = replaceInText(data.rows);
  }

  return { ...node, data };
}

/**
 * @param {Record<string, object>} nodes
 * @param {string} moduleId
 * @returns {{ nodes: Record<string, object>, remapMap: Record<string, string>, collisions: object[] }}
 */
export function namespaceModuleCallbacks(nodes, moduleId) {
  const registry = buildCallbackRegistry(nodes);
  const remapMap = {};
  const collisions = [];

  for (const [callback, nodeIds] of registry.entries()) {
    const scoped = scopeCallback(callback, moduleId);
    if (scoped !== callback) remapMap[callback] = scoped;
    if (registry.has(scoped) && scoped !== callback) {
      collisions.push({
        kind: 'callback',
        code: 'callback_collision',
        message: `Callback "${callback}" conflicts with existing "${scoped}"`,
        moduleId,
        existing: scoped,
        incoming: callback,
        nodeIds,
      });
    }
  }

  const out = {};
  for (const [id, node] of Object.entries(nodes)) {
    out[id] = remapCallbacksInNode(node, remapMap);
  }
  return { nodes: out, remapMap, collisions };
}

/**
 * @param {Record<string, object>} baseNodes
 * @param {Record<string, object>} incomingNodes
 * @returns {object[]}
 */
export function detectCallbackCollisions(baseNodes, incomingNodes) {
  const baseReg = buildCallbackRegistry(baseNodes);
  const issues = [];
  for (const [cb, nodeIds] of buildCallbackRegistry(incomingNodes)) {
    if (baseReg.has(cb)) {
      issues.push({
        kind: 'callback',
        code: 'callback_collision',
        message: `Callback "${cb}" already used in graph`,
        existing: cb,
        incomingNodeIds: nodeIds,
        existingNodeIds: baseReg.get(cb),
      });
    }
  }
  return issues;
}
