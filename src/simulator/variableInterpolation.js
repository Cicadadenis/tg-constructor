/**
 * ManyChat-style {{variable}} interpolation for simulator preview text.
 */

const VAR_PATTERN = /\{\{\s*([a-zA-Z_][\w.]*)\s*\}\}/g;

export function interpolateTemplate(text, variables = {}) {
  const src = String(text ?? '');
  if (!src.includes('{{')) return src;
  return src.replace(VAR_PATTERN, (_, key) => {
    const parts = String(key).split('.');
    let cur = variables;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') {
        cur = undefined;
        break;
      }
      cur = cur[p];
    }
    if (cur == null) return '';
    return String(cur);
  });
}

export function applyInterpolationToEntries(entries, variables) {
  if (!variables || !Object.keys(variables).length) return entries;
  return (entries || []).map((e) => {
    if (!e?.text || typeof e.text !== 'string') return e;
    return { ...e, text: interpolateTemplate(e.text, variables) };
  });
}

export function variablesSnapshotFromSubscriber(subCtx) {
  if (!subCtx?.subscriber) return {};
  const sub = subCtx.subscriber;
  const session = subCtx.session ?? {};
  const fields = sub.customFields ?? sub.fields ?? {};
  const attrs = sub.attributes ?? {};
  const tags = Array.isArray(sub.tags) ? sub.tags : [];
  return {
    first_name: sub.displayName?.split?.(' ')?.[0] ?? sub.firstName ?? 'Preview',
    last_name: sub.lastName ?? '',
    full_name: sub.displayName ?? 'Preview User',
    user_id: sub.externalUserId ?? 'sandbox-user',
    ...fields,
    ...attrs,
    tags: tags.join(', '),
    session_id: session.id ?? '',
    flow_id: session.flowId ?? subCtx.flowId ?? '',
  };
}
