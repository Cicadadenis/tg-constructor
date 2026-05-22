/**
 * Transient editor session — nodes/fields being edited are not compile-blocking.
 * Keyboard insertion uses a short transaction so validation runs after graph + projection commit.
 */

/** @typedef {{ fields: Set<string>, since: number, pendingCallbacks: boolean }} NodeEditState */

/** @type {Map<string, NodeEditState>} */
const editingNodes = new Map();

/** @type {Map<string, { since: number, snapshot: object|null }>} */
const keyboardInsertions = new Map();

const KEYBOARD_DRAFT_FIELDS = new Set([
  'rows',
  'buttons',
  'markup',
  'uiAttachments',
  'label',
  'data',
  'callbackPrefix',
  'dataPrefix',
]);

export const VALIDATION_STAGE = Object.freeze({
  /** Draft / in-progress edits — no blocking callback validation */
  EDIT: 'edit',
  /** Atomic keyboard row insert — same defer rules as edit */
  INSERTION: 'insertion',
  /** Graph committed — callback issues are warnings only */
  COMMITTED: 'committed',
  /** Run / export — strict blocking */
  COMPILE: 'compile',
});

/**
 * @param {string} nodeId
 */
export function beginNodeEdit(nodeId) {
  const id = String(nodeId || '').trim();
  if (!id) return;
  const prev = editingNodes.get(id);
  editingNodes.set(id, {
    fields: prev?.fields || new Set(),
    since: Date.now(),
    pendingCallbacks: prev?.pendingCallbacks ?? true,
  });
}

/**
 * @param {string} nodeId
 */
export function endNodeEdit(nodeId) {
  const id = String(nodeId || '').trim();
  if (id) editingNodes.delete(id);
}

export function clearAllNodeEdits() {
  editingNodes.clear();
  keyboardInsertions.clear();
}

/**
 * @param {string} nodeId
 * @param {string} [field]
 */
export function markDraftField(nodeId, field) {
  const id = String(nodeId || '').trim();
  if (!id) return;
  const entry = editingNodes.get(id) || {
    fields: new Set(),
    since: Date.now(),
    pendingCallbacks: true,
  };
  if (field) entry.fields.add(String(field));
  if (KEYBOARD_DRAFT_FIELDS.has(field) || field === 'uiAttachments') {
    entry.pendingCallbacks = true;
  }
  entry.since = Date.now();
  editingNodes.set(id, entry);
}

/**
 * @param {string} nodeId
 */
export function commitNodeEdit(nodeId) {
  const id = String(nodeId || '').trim();
  if (!id) return;
  const entry = editingNodes.get(id);
  if (!entry) return;
  entry.pendingCallbacks = false;
  entry.fields.clear();
}

/**
 * @returns {boolean}
 */
export function isGraphInEditMode() {
  return editingNodes.size > 0 || keyboardInsertions.size > 0;
}

/**
 * @param {string} nodeId
 * @returns {boolean}
 */
export function isNodeInEditMode(nodeId) {
  const id = String(nodeId || '').trim();
  return editingNodes.has(id) || keyboardInsertions.has(id);
}

/**
 * @param {string} nodeId
 * @returns {boolean}
 */
export function nodeHasPendingCallbacks(nodeId) {
  const entry = editingNodes.get(String(nodeId || ''));
  return Boolean(entry?.pendingCallbacks);
}

/**
 * @param {string} [nodeId]
 * @returns {boolean}
 */
export function isKeyboardInsertionActive(nodeId) {
  if (nodeId) return keyboardInsertions.has(String(nodeId));
  return keyboardInsertions.size > 0;
}

/**
 * Start atomic inline/reply keyboard insert (validation deferred until commit).
 * @param {string} nodeId
 * @param {object|null} [snapshot] — optional uiAttachments snapshot for rollback
 */
export function beginKeyboardInsertion(nodeId, snapshot = null) {
  const id = String(nodeId || '').trim();
  if (!id) return;
  beginNodeEdit(id);
  markDraftField(id, 'uiAttachments');
  keyboardInsertions.set(id, { since: Date.now(), snapshot });
}

/**
 * @param {string} nodeId
 */
export function commitKeyboardInsertion(nodeId) {
  const id = String(nodeId || '').trim();
  if (!id) return;
  keyboardInsertions.delete(id);
  // Stay in edit mode until explicit commitNodeEdit — allows handler CTA without blocking overlay
}

/**
 * @param {string} nodeId
 */
export function rollbackKeyboardInsertion(nodeId) {
  const id = String(nodeId || '').trim();
  keyboardInsertions.delete(id);
  endNodeEdit(id);
}

/**
 * Callback handler validation deferred during draft edit / insertion.
 * @param {string} [nodeId]
 * @returns {boolean}
 */
export function isCallbackValidationDeferred(nodeId) {
  if (isKeyboardInsertionActive(nodeId)) return true;
  if (nodeId && nodeHasPendingCallbacks(nodeId)) return true;
  if (nodeId && isNodeInEditMode(nodeId)) return true;
  if (isGraphInEditMode()) return true;
  return false;
}

/**
 * @param {string} [nodeId]
 * @returns {import('./graph_edit_session.js').VALIDATION_STAGE[keyof typeof VALIDATION_STAGE]}
 */
export function resolveSessionValidationStage(nodeId) {
  if (isKeyboardInsertionActive(nodeId)) return VALIDATION_STAGE.INSERTION;
  if (nodeId && isNodeInEditMode(nodeId)) return VALIDATION_STAGE.EDIT;
  if (isGraphInEditMode()) return VALIDATION_STAGE.EDIT;
  return VALIDATION_STAGE.COMMITTED;
}

/**
 * @returns {string[]}
 */
export function getEditingNodeIds() {
  return [...new Set([...editingNodes.keys(), ...keyboardInsertions.keys()])];
}
