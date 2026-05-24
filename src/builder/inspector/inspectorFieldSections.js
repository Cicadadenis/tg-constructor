/**
 * Maps inspector fields into persistent panel sections.
 */

/** @typedef {'basic' | 'io' | 'execution' | 'ui' | 'advanced'} InspectorSectionId */

export const INSPECTOR_SECTION_ORDER = Object.freeze([
  'basic',
  'io',
  'execution',
  'ui',
  'advanced',
]);

const EXECUTION_KEYS = new Set([
  'seconds', 'mode', 'count', 'level', 'role', 'roles', 'target', 'output',
  'list', 'var', 'columns', 'idField', 'labelField', 'callbackPrefix',
]);

const UI_KEYS = new Set([
  'markup', 'rows', 'buttons', 'resizeKeyboard', 'oneTimeKeyboard', 'options',
  'caption', 'question', 'text', 'items', 'title',
]);

const ADVANCED_KEYS = new Set([
  'url', 'file', 'file_id', 'filename', 'lat', 'lon', 'latitude', 'longitude',
  'data', 'label', '_graphRefId', 'phone', 'file', 'variants', 'cases',
]);

const BASIC_KEYS = new Set([
  'cmd', 'cond', 'token', 'version', 'name', 'blockname', 'commands',
  'varname', 'value', 'key', 'global', 'blockname', 'middleware',
]);

/**
 * @param {{ key: string, section?: string }} field
 * @param {string} [blockType]
 * @returns {InspectorSectionId}
 */
export function fieldSectionFor(field, blockType = '') {
  if (field.section && INSPECTOR_SECTION_ORDER.includes(field.section)) {
    return /** @type {InspectorSectionId} */ (field.section);
  }
  const key = String(field.key || '');
  const type = String(blockType || '');

  if (type === 'callback' && (key === 'data' || key === 'label')) return 'ui';
  if (type === 'message' && key === 'text') return 'ui';
  if (type === 'reply' && key === 'text') return 'ui';
  if (ADVANCED_KEYS.has(key)) return 'advanced';
  if (EXECUTION_KEYS.has(key)) return 'execution';
  if (UI_KEYS.has(key)) return 'ui';
  if (BASIC_KEYS.has(key)) return 'basic';
  return 'basic';
}

/**
 * @param {readonly { key: string }[]} fields
 * @param {string} section
 * @param {string} [blockType]
 */
export function fieldsForSection(fields, section, blockType) {
  return (fields || []).filter((f) => fieldSectionFor(f, blockType) === section);
}
