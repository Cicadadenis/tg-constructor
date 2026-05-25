/**
 * Visual port styling by semantic kind (editor-only).
 */

/** @typedef {'flow'|'keyboard'|'true'|'false'|'body'|'done'} PortKind */

/** @type {Record<string, { className: string, color: string, labelColor: string }>} */
export const PORT_KIND_THEME = Object.freeze({
  flow: { className: 'visual-port--flow', color: 'var(--vn-accent, #2563eb)', labelColor: '#94a3b8' },
  keyboard: { className: 'visual-port--keyboard', color: '#d97706', labelColor: '#b45309' },
  true: { className: 'visual-port--true', color: '#16a34a', labelColor: '#15803d' },
  false: { className: 'visual-port--false', color: '#dc2626', labelColor: '#b91c1c' },
  body: { className: 'visual-port--body', color: '#6366f1', labelColor: '#4f46e5' },
  done: { className: 'visual-port--done', color: '#64748b', labelColor: '#475569' },
});

/**
 * @param {string | undefined} kind
 */
export function portKindTheme(kind) {
  return PORT_KIND_THEME[kind] || PORT_KIND_THEME.flow;
}
