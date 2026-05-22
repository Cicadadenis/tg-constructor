import { canRenderUi, uiAttachments } from '../capabilityEngine.js';

const FEATURE_BY_TYPE = {
  http: 'http_client',
  poll: 'poll',
  scenario: 'scenarios',
  step: 'scenarios',
  database: 'sql',
  payment: 'payments',
  analytics: 'analytics',
  classify: 'classification',
  notify: 'telegram_notify',
  broadcast: 'telegram_broadcast',
  check_sub: 'telegram_channel_gate',
  member_role: 'telegram_admin',
  forward_msg: 'telegram_forward',
  loop: 'control_flow_loops',
  save_global: 'global_kv',
  get_user: 'cross_user_kv',
  db_delete: 'kv_delete',
  all_keys: 'kv_scan',
  call_block: 'block_call',
  random: 'random_reply',
  inline: 'inline_keyboard',
  inline_db: 'inline_keyboard',
  menu: 'bot_menu',
  switch: 'switch',
};

function inferFeaturesFromTypes(types) {
  const set = new Set();
  for (const t of types) {
    const f = FEATURE_BY_TYPE[t];
    if (f) set.add(f);
  }
  return [...set].sort();
}

export function inferRequiredFeaturesFromFlow(flow) {
  const types = (flow?.nodes || []).map((n) => n.data?.type || n.type).filter(Boolean);
  return inferFeaturesFromTypes(types);
}

export function inferRequiredFeaturesFromStacks(stacks) {
  const types = [];
  for (const s of stacks || []) {
    for (const b of s.blocks || []) {
      types.push(b.type);
      const attachments = canRenderUi(b?.type) ? uiAttachments(b) : uiAttachments(null);
      if (attachments.buttons.length) types.push('buttons');
      if (attachments.inline.length) types.push('inline');
      for (const item of attachments.media) types.push(item?.kind || 'photo');
    }
  }
  return inferFeaturesFromTypes(types);
}
