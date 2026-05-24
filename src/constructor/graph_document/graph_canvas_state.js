/**
 * Canvas UX state — when the graph is empty, broken, or not runnable.
 */

import { createGraphDocument } from './graph_document.js';
import { graphDocumentToProjectGraph } from './graph_project_bridge.js';
import { projectGraphToFlow } from '../../../core/graph/model.js';
import { isFlowEmptyForCodegen } from '../../../core/codegen/emptyGraph.js';

const ROOT_ENTRY_TYPES = new Set([
  'start', 'command', 'callback', 'else',
  'on_text', 'on_photo', 'on_voice', 'on_document', 'on_sticker', 'on_location', 'on_contact',
]);

const SETTINGS_TYPES = new Set(['bot', 'version', 'commands', 'global']);

/** Palette-visible nodes — onboarding hides when any of these exist. */
const CANVAS_SETTINGS_ONLY = SETTINGS_TYPES;

/**
 * @param {object} node
 */
export function isUserVisibleCanvasNode(node) {
  const t = String(node?.type || '').trim();
  return Boolean(t) && !CANVAS_SETTINGS_ONLY.has(t);
}

/**
 * Any block the user can see on canvas (start, message, media, keyboard, …).
 * @param {object} document
 */
export function hasUserVisibleCanvasNodes(document) {
  const doc = createGraphDocument(document);
  return Object.values(doc.nodes || {}).some(isUserVisibleCanvasNode);
}

/**
 * Onboarding overlay — only when the canvas has no blocks at all.
 * Settings nodes (version, bot, …) count as content and hide the overlay.
 * @param {object} document
 */
export function shouldShowCanvasOnboardingOverlay(document) {
  const doc = createGraphDocument(document);
  return Object.keys(doc.nodes || {}).length === 0;
}

/**
 * Graph has blocks but only metadata (version/bot/commands) — no handlers for bot.py yet.
 * @param {object} document
 */
export function isGraphSettingsOnlyShell(document) {
  const doc = createGraphDocument(document);
  if (Object.keys(doc.nodes || {}).length === 0) return false;
  return !hasUserVisibleCanvasNodes(doc);
}

/**
 * Node to focus after import / first insert.
 * @param {object} document
 * @returns {string|null}
 */
export function pickPrimaryCanvasNodeId(document) {
  const doc = createGraphDocument(document);
  const nodes = Object.values(doc.nodes || {});
  const start = nodes.find((n) => n.type === 'start');
  if (start) return start.id;
  const visible = nodes.find(isUserVisibleCanvasNode);
  return visible?.id || nodes[0]?.id || null;
}

/**
 * Orphan blocks with no entry point and no valid edges — typical corrupt autosave.
 * @param {object} document
 */
export function isGraphBrokenShell(document) {
  const doc = createGraphDocument(document);
  const nodes = Object.values(doc.nodes || {});
  if (nodes.length === 0) return false;

  const validEdges = Object.values(doc.edges || {}).filter((e) => !e.invalid);
  const hasEntry = nodes.some((n) => ROOT_ENTRY_TYPES.has(String(n.type || '').trim()));
  const flowNodes = nodes.filter((n) => !SETTINGS_TYPES.has(String(n.type || '').trim()));

  if (flowNodes.length === 0) return false;
  if (!hasEntry && validEdges.length === 0) return true;
  return false;
}

/**
 * True when the canvas should behave as empty (no compile overlay / no codegen).
 * @param {object} document
 */
export function isGraphEffectivelyEmpty(document) {
  const doc = createGraphDocument(document);
  if (Object.keys(doc.nodes || {}).length === 0) return true;
  if (isGraphSettingsOnlyShell(document)) return false;
  if (isGraphBrokenShell(document)) return true;
  try {
    const flow = projectGraphToFlow(graphDocumentToProjectGraph(doc));
    return isFlowEmptyForCodegen(flow);
  } catch {
    return true;
  }
}

/**
 * @param {object} document
 */
export function shouldAutoClearCorruptedGraph(document) {
  return isGraphBrokenShell(document);
}
