/**
 * Graph-native helper functions.
 * All lookups operate directly on GraphDocument — no stack transforms.
 * GraphDocument = ONLY source of truth.
 */

import { isPlaceholderBotToken } from '../../../core/botTokenPlaceholders.mjs';
import { canAttach, canRenderUi } from '../../../core/capabilityEngine.js';
import { DEFAULT_PROPS } from '../../constructor/block_catalog.js';
import { getChainStepBelow, hasIncomingFlowEdge } from '../../builder/blockLayout.js';
import { applyFlowBuilderLayout } from '../../builder/flowLayout/applyFlowBuilderLayout.js';
import { readLayoutModeFromMetadata } from '../../builder/flowLayout/flowLayoutModes.js';
import { getNodePortDescriptors } from '../../constructor/graph_document/operation_registry.js';

import {
  UnknownBlockTypeError,
  graphResolveNodeType,
  resolveCanonicalNodeType,
} from '../../constructor/graph_document/graph_node_payload.js';

export { UnknownBlockTypeError, graphResolveNodeType, resolveCanonicalNodeType };

/** Whether parent→child can be linked as a vertical flow chain (both sides need ports). */
export function graphCanChainAfter(parentType, newType) {
  const outs = getNodePortDescriptors(parentType).outputs || [];
  const ins = getNodePortDescriptors(newType).inputs || [];
  return outs.length > 0 && ins.length > 0;
}

// ─── NODE LOOKUPS ────────────────────────────────────────────────────────────

export function graphGetNodes(graph) {
  return Object.values(graph.getGraphDocument().nodes || {});
}

export function graphHasNodeOfType(graph, type) {
  const want = String(type || '').trim();
  return graphGetNodes(graph).some((n) => graphResolveNodeType(n) === want);
}

export function graphHasBotBlock(graph) {
  return graphHasNodeOfType(graph, 'bot');
}

/** True when a «Бот» block exists and a real token is set on canvas or in profile test_token. */
export function graphHasRunnableBot(graph, currentUser) {
  if (!graphHasBotBlock(graph)) return false;
  const tok = graphResolveBotToken(graph, currentUser);
  return Boolean(tok) && !isPlaceholderBotToken(tok);
}

/** Inject resolved token into generated bot.py before POST /api/run. */
export function injectBotTokenInPython(code, token) {
  const t = String(token || '').trim();
  if (!t || isPlaceholderBotToken(t)) return String(code ?? '');
  const escaped = t.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  let out = String(code ?? '');
  out = out.replace(/BOT_TOKEN\s*=\s*['"][^'"]*['"]/g, `BOT_TOKEN = "${escaped}"`);
  out = out.replace(/Bot\s*\(\s*token\s*=\s*['"][^'"]*['"]/gi, `Bot(token="${escaped}"`);
  return out;
}

// ─── COMMAND UNIQUENESS ──────────────────────────────────────────────────────

export function graphNormalizeCmd(cmd) {
  return String(cmd ?? '').replace(/^\//, '').trim().toLowerCase();
}

export function graphHasCommandNamed(graph, cmdName) {
  const name = graphNormalizeCmd(cmdName);
  if (!name) return false;
  return graphGetNodes(graph).some(
    (n) => graphResolveNodeType(n) === 'command' && graphNormalizeCmd(n.data?.cmd) === name,
  );
}

const FALLBACK_COMMAND_NAMES = ['menu', 'help', 'settings', 'about', 'info'];

export function graphGetNextCommandName(graph) {
  for (const name of FALLBACK_COMMAND_NAMES) {
    if (!graphHasCommandNamed(graph, name)) return name;
  }
  let i = 2;
  while (graphHasCommandNamed(graph, `command${i}`)) i += 1;
  return `command${i}`;
}

// ─── UNIQUE BLOCK VALIDATION ─────────────────────────────────────────────────

export const GRAPH_UNIQUE_BLOCK_TYPES = Object.freeze([
  'version', 'bot', 'commands', 'global', 'start', 'middleware',
]);

const UNIQUE_BLOCK_TYPES = new Set(GRAPH_UNIQUE_BLOCK_TYPES);

const UNIQUE_BLOCK_LABEL_RU = Object.freeze({
  version: 'Версия',
  bot: 'Бот',
  commands: 'Команды меню',
  global: 'Глобальная',
  start: 'Старт',
  middleware: 'Middleware',
});

export function graphUniqueBlockLabel(type, lang = 'ru') {
  const t = String(type || '').trim();
  if (lang === 'en') {
    const en = { version: 'Version', bot: 'Bot', commands: 'Menu commands', global: 'Global', start: 'Start' };
    return en[t] || t;
  }
  return UNIQUE_BLOCK_LABEL_RU[t] || t;
}

export function graphGetUniqueConflictMessage(graph, type, props = {}, lang = 'ru') {
  if (UNIQUE_BLOCK_TYPES.has(type) && graphHasNodeOfType(graph, type)) {
    const label = graphUniqueBlockLabel(type, lang);
    return lang === 'en'
      ? `Block "${label}" is already on the canvas. Remove the existing one first.`
      : `Блок «${label}» уже есть на холсте. Удалите старый, чтобы добавить новый.`;
  }
  if (type === 'start' && graphHasCommandNamed(graph, 'start')) {
    return lang === 'en'
      ? 'Command /start already exists. Remove it before adding Start.'
      : 'Для /start уже есть блок «Команда /start». Удалите его перед добавлением «Старт».';
  }
  if (type === 'command') {
    const cmd = graphNormalizeCmd(props.cmd ?? 'start');
    if (!cmd) return null;
    if (cmd === 'start' && graphHasNodeOfType(graph, 'start')) {
      return lang === 'en'
        ? 'Start block already exists. Use a different command.'
        : 'Для /start уже есть блок «Старт». Используйте другую команду.';
    }
    if (graphHasCommandNamed(graph, cmd)) {
      return lang === 'en'
        ? `Command /${cmd} is already on the canvas.`
        : `Команда /${cmd} уже есть на холсте.`;
    }
  }
  return null;
}

export function graphCanDuplicateNodeType(type) {
  return !UNIQUE_BLOCK_TYPES.has(String(type || '').trim());
}

// ─── BOT TOKEN RESOLUTION ────────────────────────────────────────────────────

export function graphResolveBotToken(graph, currentUser) {
  const fromProfile = currentUser?.test_token?.trim();
  if (fromProfile) return fromProfile;
  for (const n of graphGetNodes(graph)) {
    if (graphResolveNodeType(n) === 'bot') {
      const t = String(n.data?.token ?? '').trim();
      if (t) return t;
    }
  }
  return '';
}

// ─── NEW NODE PROPS ──────────────────────────────────────────────────────────

export function graphMakePropsForNewNode(graph, type, currentUser) {
  const props = { ...(DEFAULT_PROPS[type] || {}) };
  if (type === 'bot') {
    const tok = graphResolveBotToken(graph, currentUser);
    if (tok) props.token = tok;
  }
  if (type === 'command') {
    const cmd = graphNormalizeCmd(props.cmd);
    if (
      (cmd === 'start' && graphHasNodeOfType(graph, 'start')) ||
      graphHasCommandNamed(graph, cmd)
    ) {
      props.cmd = graphGetNextCommandName(graph);
    }
  }
  return props;
}

// ─── FLOW CHAIN LAYOUT ───────────────────────────────────────────────────────

const SETTINGS_NODE_TYPES = new Set(['bot', 'version', 'commands', 'global']);

/**
 * Resolve where to attach a new flow block when inserting after `anchorId`.
 * Settings nodes (bot, version, …) have no flow output — follow the chain to
 * «Старт» / command or the single start node on canvas.
 */
export function resolveFlowInsertAnchorId(doc, anchorId, newType) {
  const id = String(anchorId || '').trim();
  const type = String(newType || '').trim();
  if (!id || !doc?.nodes?.[id]) return null;

  const anchorType = graphResolveNodeType(doc.nodes[id]);
  if (graphCanChainAfter(anchorType, type)) return id;

  if (SETTINGS_NODE_TYPES.has(anchorType)) {
    const out = getOutgoingFlowEdge(doc, id);
    if (out?.target && doc.nodes[out.target]) {
      const childType = graphResolveNodeType(doc.nodes[out.target]);
      if (graphCanChainAfter(childType, type)) return out.target;
    }
    const starts = Object.values(doc.nodes || {}).filter(
      (n) => graphResolveNodeType(n) === 'start',
    );
    if (starts.length === 1) return starts[0].id;
    return null;
  }

  return doc.nodes[id] ? id : null;
}

/**
 * Valid chain-insert anchor for palette drop, or null → place at drop coordinates.
 */
export function resolvePaletteChainParentId(doc, selectedNodeId, newType) {
  const id = String(selectedNodeId || '').trim();
  if (!id) return null;
  const effective = resolveFlowInsertAnchorId(doc, id, newType);
  if (!effective || !doc?.nodes?.[effective]) return null;
  return effective;
}

/**
 * Find nearest downstream node that can host UI attachments (inline/buttons/media).
 * Used when «Старт» / «Команда» is selected but buttons belong on the render block below.
 */
export function resolveUiAttachmentTargetNodeId(doc, startNodeId, kind, maxHops = 16) {
  const feature = String(kind || '').trim();
  if (!feature || !startNodeId) return null;
  let currentId = String(startNodeId);
  const visited = new Set();
  for (let hop = 0; hop <= maxHops; hop += 1) {
    if (!currentId || visited.has(currentId)) return null;
    visited.add(currentId);
    const node = doc?.nodes?.[currentId];
    if (!node) return null;
    const ownerType = graphResolveNodeType(node);
    if (canRenderUi(ownerType) && canAttach(feature, ownerType)) return currentId;
    const edge = getOutgoingFlowEdge(doc, currentId);
    if (!edge?.target) return null;
    currentId = edge.target;
  }
  return null;
}

/** Primary outgoing flow edge from a node (deterministic). */
export function getOutgoingFlowEdge(doc, nodeId) {
  const edges = Object.values(doc.edges || {}).filter((e) => e.source === nodeId);
  if (!edges.length) return null;
  edges.sort((a, b) => {
    const pa = a.sourcePort === 'flow' ? 0 : 1;
    const pb = b.sourcePort === 'flow' ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return String(a.id).localeCompare(String(b.id));
  });
  return edges[0];
}

/** @deprecated Use applyFlowBuilderLayout — kept for call-site compatibility. */
export function layoutFlowChain(graph, _startNodeId, mode) {
  applyFlowBuilderLayout(graph, mode);
}

/** Deterministic top→bottom layout for the full graph. */
export function layoutAllFlowChains(graph, mode) {
  const resolved = mode ?? readLayoutModeFromMetadata(graph.getGraphDocument().metadata);
  applyFlowBuilderLayout(graph, resolved);
}

/**
 * @deprecated Replaced by deterministic flow layout (same implementation).
 */
export function spreadOverlappingNodes(graph, mode) {
  layoutAllFlowChains(graph, mode);
}
