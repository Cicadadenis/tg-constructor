/**
 * Semantic capability registry — dependencies and synthesis metadata.
 */

export const CAPABILITY_IDS = Object.freeze({
  MENU_ENTRYPOINT: 'menu_entrypoint',
  BUTTON_NAVIGATION: 'button_navigation',
  USER_INPUT: 'user_input',
  INPUT_COLLECTION: 'input_collection',
  CONFIRMATION: 'confirmation_response',
  CONDITIONAL_BRANCH: 'conditional_branch',
  CATALOG_NAVIGATION: 'catalog_navigation',
  INLINE_SELECTION: 'inline_selection',
  STATE_PERSISTENCE: 'state_persistence',
  SUBSCRIPTION_GATE: 'subscription_gate',
  ARITHMETIC_EVAL: 'arithmetic_evaluation',
  FILE_EXCHANGE: 'file_exchange',
  STATUS_QUERY: 'status_query',
  INLINE_CALLBACK_ROUTER: 'inline_callback_router',
});

/** @type {Record<string, { requires: string[], provides: string[], priority: number }>} */
export const CAPABILITY_REGISTRY = Object.freeze({
  [CAPABILITY_IDS.MENU_ENTRYPOINT]: Object.freeze({
    requires: [],
    provides: ['greet', 'main_menu'],
    priority: 10,
  }),
  [CAPABILITY_IDS.BUTTON_NAVIGATION]: Object.freeze({
    requires: [CAPABILITY_IDS.MENU_ENTRYPOINT],
    provides: ['callback_routing'],
    priority: 20,
  }),
  [CAPABILITY_IDS.USER_INPUT]: Object.freeze({
    requires: [],
    provides: ['ask'],
    priority: 15,
  }),
  [CAPABILITY_IDS.INPUT_COLLECTION]: Object.freeze({
    requires: [CAPABILITY_IDS.USER_INPUT],
    provides: ['multi_step_form'],
    priority: 25,
  }),
  [CAPABILITY_IDS.CONFIRMATION]: Object.freeze({
    requires: [CAPABILITY_IDS.INPUT_COLLECTION],
    provides: ['confirm_message'],
    priority: 30,
  }),
  [CAPABILITY_IDS.CONDITIONAL_BRANCH]: Object.freeze({
    requires: [],
    provides: ['branch'],
    priority: 35,
  }),
  [CAPABILITY_IDS.CATALOG_NAVIGATION]: Object.freeze({
    requires: [CAPABILITY_IDS.BUTTON_NAVIGATION],
    provides: ['catalog'],
    priority: 40,
  }),
  [CAPABILITY_IDS.INLINE_SELECTION]: Object.freeze({
    requires: [CAPABILITY_IDS.CATALOG_NAVIGATION, CAPABILITY_IDS.INLINE_CALLBACK_ROUTER],
    provides: ['inline_db'],
    priority: 45,
  }),
  [CAPABILITY_IDS.INLINE_CALLBACK_ROUTER]: Object.freeze({
    requires: [CAPABILITY_IDS.BUTTON_NAVIGATION],
    provides: ['callback_routing', 'inline_router'],
    priority: 42,
  }),
  [CAPABILITY_IDS.STATE_PERSISTENCE]: Object.freeze({
    requires: [],
    provides: ['save', 'get'],
    priority: 28,
  }),
  [CAPABILITY_IDS.SUBSCRIPTION_GATE]: Object.freeze({
    requires: [CAPABILITY_IDS.MENU_ENTRYPOINT],
    provides: ['subscription'],
    priority: 22,
  }),
  [CAPABILITY_IDS.ARITHMETIC_EVAL]: Object.freeze({
    requires: [CAPABILITY_IDS.USER_INPUT],
    provides: ['calculate'],
    priority: 25,
  }),
  [CAPABILITY_IDS.FILE_EXCHANGE]: Object.freeze({
    requires: [CAPABILITY_IDS.USER_INPUT],
    provides: ['send_file'],
    priority: 26,
  }),
  [CAPABILITY_IDS.STATUS_QUERY]: Object.freeze({
    requires: [CAPABILITY_IDS.STATE_PERSISTENCE],
    provides: ['status_lookup'],
    priority: 32,
  }),
});

const GOAL_CAPABILITY_MAP = Object.freeze({
  calculator: [CAPABILITY_IDS.MENU_ENTRYPOINT, CAPABILITY_IDS.ARITHMETIC_EVAL, CAPABILITY_IDS.USER_INPUT],
  order_form: [CAPABILITY_IDS.MENU_ENTRYPOINT, CAPABILITY_IDS.BUTTON_NAVIGATION, CAPABILITY_IDS.INPUT_COLLECTION, CAPABILITY_IDS.CONFIRMATION],
  catalog: [CAPABILITY_IDS.MENU_ENTRYPOINT, CAPABILITY_IDS.CATALOG_NAVIGATION, CAPABILITY_IDS.INLINE_SELECTION],
  subscription: [CAPABILITY_IDS.MENU_ENTRYPOINT, CAPABILITY_IDS.SUBSCRIPTION_GATE],
  form_collection: [CAPABILITY_IDS.MENU_ENTRYPOINT, CAPABILITY_IDS.INPUT_COLLECTION, CAPABILITY_IDS.CONFIRMATION],
  age_gate: [CAPABILITY_IDS.USER_INPUT, CAPABILITY_IDS.CONDITIONAL_BRANCH],
  request_intake_with_status: [CAPABILITY_IDS.MENU_ENTRYPOINT, CAPABILITY_IDS.INPUT_COLLECTION, CAPABILITY_IDS.STATE_PERSISTENCE, CAPABILITY_IDS.STATUS_QUERY],
  file_storage: [CAPABILITY_IDS.MENU_ENTRYPOINT, CAPABILITY_IDS.FILE_EXCHANGE],
  echo: [CAPABILITY_IDS.MENU_ENTRYPOINT],
  informational: [CAPABILITY_IDS.MENU_ENTRYPOINT],
});

const BOT_TYPE_CAPABILITIES = Object.freeze({
  calculator: [CAPABILITY_IDS.ARITHMETIC_EVAL],
  commerce: [CAPABILITY_IDS.CATALOG_NAVIGATION, CAPABILITY_IDS.INPUT_COLLECTION],
  subscription: [CAPABILITY_IDS.SUBSCRIPTION_GATE],
  support: [CAPABILITY_IDS.INPUT_COLLECTION, CAPABILITY_IDS.STATE_PERSISTENCE, CAPABILITY_IDS.STATUS_QUERY],
  informational: [CAPABILITY_IDS.MENU_ENTRYPOINT],
});

export function capabilitiesForGoal(primaryGoal, botType) {
  const goal = String(primaryGoal || '').toLowerCase();
  const fromGoal = GOAL_CAPABILITY_MAP[goal] || GOAL_CAPABILITY_MAP.informational;
  const fromType = BOT_TYPE_CAPABILITIES[String(botType || '').toLowerCase()] || [];
  return [...new Set([...fromGoal, ...fromType])];
}

export function expandCapabilityDependencies(requested) {
  const resolved = new Set();
  const injected = [];
  const queue = [...requested];

  while (queue.length) {
    const id = queue.shift();
    if (!id || resolved.has(id) || !CAPABILITY_REGISTRY[id]) continue;
    resolved.add(id);
    for (const dep of CAPABILITY_REGISTRY[id].requires) {
      if (!resolved.has(dep)) {
        injected.push(dep);
        queue.push(dep);
      }
    }
  }

  return {
    capabilities: [...resolved].sort(
      (a, b) => (CAPABILITY_REGISTRY[a]?.priority || 0) - (CAPABILITY_REGISTRY[b]?.priority || 0),
    ),
    injected,
  };
}
