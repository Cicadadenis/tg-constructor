import { CAPABILITY_ACTIONS } from '../../capabilities/capabilityIds.mjs';

export function capabilityForFlowNode(node) {
  const type = String(node.type || '');
  const map = {
    present: CAPABILITY_ACTIONS.SEND_MESSAGE,
    collect: CAPABILITY_ACTIONS.PROMPT,
    notify: CAPABILITY_ACTIONS.SEND_MESSAGE,
    remember: CAPABILITY_ACTIONS.CTX_SET_VAR,
    persist: CAPABILITY_ACTIONS.SAVE_STORAGE,
    load: CAPABILITY_ACTIONS.LOAD_STORAGE,
    send_file: CAPABILITY_ACTIONS.SEND_DOCUMENT,
    route_inline: CAPABILITY_ACTIONS.INLINE_FROM_LIST,
    branch: CAPABILITY_ACTIONS.BRANCH,
    terminal: CAPABILITY_ACTIONS.HALT,
  };
  return map[type] || CAPABILITY_ACTIONS.NOOP;
}

export function payloadForFlowNode(node) {
  const p = node.payload || {};
  const type = String(node.type || '');
  if (type === 'present') return { text: p.message, buttons: p.buttons, inlineCatalog: p.inlineCatalog };
  if (type === 'collect') return { question: p.prompt, varname: p.field };
  if (type === 'notify') return { text: p.text };
  if (type === 'remember') return { name: p.field, value: p.value };
  if (type === 'persist') return { key: p.key, value: p.value, scope: p.scope };
  if (type === 'load') return { key: p.key, varname: p.field };
  if (type === 'send_file') return { file: `{${p.field}}` };
  if (type === 'branch') return { expression: p.expression };
  return { ...p };
}
