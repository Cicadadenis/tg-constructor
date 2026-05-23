/**
 * Aiogram 3 palette — strict execution-flow order (not alphabetical).
 * Sections A–G match the real codegen pipeline; H = legacy (excluded).
 */

const AIOGRAM3_RUNTIME_LITERAL = 'aiogram3';

/** @typedef {'system' | 'framework' | 'entrypoint' | 'control' | 'fsm' | 'output' | 'media'} Aiogram3FlowRole */

/**
 * Sidebar section ids in pipeline order (categoryOrder 0–6).
 * Section B has no draggable blocks — framework is emitted in bot.py bootstrap.
 */
export const AIOGRAM3_FLOW_SECTIONS = Object.freeze([
  Object.freeze({ id: 'system_root', categoryOrder: 0, flowRole: 'system', label: Object.freeze({ ru: 'Система', en: 'System', uk: 'Система' }) }),
  Object.freeze({ id: 'core_framework', categoryOrder: 1, flowRole: 'framework', label: Object.freeze({ ru: 'Ядро aiogram', en: 'Core framework', uk: 'Ядро aiogram' }) }),
  Object.freeze({ id: 'entry_points', categoryOrder: 2, flowRole: 'entrypoint', label: Object.freeze({ ru: 'Точки входа', en: 'Entry points', uk: 'Точки входу' }) }),
  Object.freeze({ id: 'control_flow', categoryOrder: 3, flowRole: 'control', label: Object.freeze({ ru: 'Управление потоком', en: 'Control flow', uk: 'Керування потоком' }) }),
  Object.freeze({ id: 'fsm', categoryOrder: 4, flowRole: 'fsm', label: Object.freeze({ ru: 'Состояние (FSM)', en: 'State (FSM)', uk: 'Стан (FSM)' }) }),
  Object.freeze({ id: 'output', categoryOrder: 5, flowRole: 'output', label: Object.freeze({ ru: 'Ответ Telegram', en: 'Telegram output', uk: 'Відповідь Telegram' }) }),
  Object.freeze({ id: 'media_output', categoryOrder: 6, flowRole: 'media', label: Object.freeze({ ru: 'Медиа', en: 'Media', uk: 'Медіа' }) }),
]);

/** Graph editor tools — always after node flow sections. */
export const AIOGRAM3_TOOLS_CATEGORY_ORDER = Object.freeze({
  graph: 7,
  relations: 7,
  data: 7,
});

const SECTION_BY_ID = Object.freeze(
  Object.fromEntries(AIOGRAM3_FLOW_SECTIONS.map((s) => [s.id, s])),
);

/**
 * Deterministic block order: section → priority within section.
 * @type {Readonly<Record<string, { section: string, categoryOrder: number, priority: number, flowRole: Aiogram3FlowRole, flowIndex: number }>>}
 */
export const AIOGRAM3_BLOCK_FLOW_META = Object.freeze(
  Object.fromEntries(
    [
      // A) SYSTEM / ROOT
      ['version', 'system_root', 0],
      ['bot', 'system_root', 1],
      ['global', 'system_root', 2],
      ['commands', 'system_root', 3],
      // C) ENTRY POINTS
      ['start', 'entry_points', 0],
      ['command', 'entry_points', 1],
      ['callback', 'entry_points', 2],
      ['on_text', 'entry_points', 3],
      ['on_photo', 'entry_points', 4],
      ['on_voice', 'entry_points', 5],
      ['on_document', 'entry_points', 6],
      ['on_sticker', 'entry_points', 7],
      ['on_location', 'entry_points', 8],
      ['on_contact', 'entry_points', 9],
      ['else', 'entry_points', 10],
      // D) CONTROL FLOW
      ['condition', 'control_flow', 0],
      ['condition_not', 'control_flow', 1],
      ['loop', 'control_flow', 2],
      ['delay', 'control_flow', 3],
      ['typing', 'control_flow', 4],
      ['log', 'control_flow', 5],
      // E) FSM
      ['ask', 'fsm', 0],
      ['remember', 'fsm', 1],
      ['save', 'fsm', 2],
      ['get', 'fsm', 3],
      ['set_global', 'fsm', 4],
      ['goto', 'fsm', 5],
      ['stop', 'fsm', 6],
      // F) OUTPUT
      ['message', 'output', 0],
      ['inline_keyboard', 'output', 1],
      ['reply_keyboard', 'output', 2],
      ['buttons', 'output', 3],
      ['inline', 'output', 4],
      // G) MEDIA
      ['photo', 'media_output', 0],
      ['video', 'media_output', 1],
      ['audio', 'media_output', 2],
      ['document', 'media_output', 3],
      ['sticker', 'media_output', 4],
      ['contact', 'media_output', 5],
      ['location', 'media_output', 6],
      ['poll', 'media_output', 7],
      ['send_file', 'media_output', 8],
      ['photo_var', 'media_output', 9],
      ['document_var', 'media_output', 10],
    ].map(([type, section, priority], flowIndex) => {
      const sec = SECTION_BY_ID[section];
      return [
        type,
        Object.freeze({
          section,
          categoryOrder: sec.categoryOrder,
          priority,
          flowRole: sec.flowRole,
          flowIndex,
          runtime: AIOGRAM3_RUNTIME_LITERAL,
        }),
      ];
    }),
  ),
);

/** Palette-visible types in strict pipeline order. */
export const AIOGRAM3_PALETTE_BLOCK_TYPES_ORDERED = Object.freeze(
  Object.keys(AIOGRAM3_BLOCK_FLOW_META),
);

const FLOW_INDEX_BY_TYPE = Object.freeze(
  Object.fromEntries(AIOGRAM3_PALETTE_BLOCK_TYPES_ORDERED.map((t, i) => [t, i])),
);

export function getAiogram3BlockFlowMeta(type) {
  return AIOGRAM3_BLOCK_FLOW_META[String(type || '').trim()] || null;
}

export function getAiogram3FlowSection(sectionId) {
  return SECTION_BY_ID[String(sectionId || '').trim()] || null;
}

/** @param {{ type?: string, categoryOrder?: number, priority?: number, flowIndex?: number, id?: string }} a @param {typeof a} b */
export function compareAiogram3PaletteEntries(a, b) {
  const ac = Number(a.categoryOrder ?? 99);
  const bc = Number(b.categoryOrder ?? 99);
  if (ac !== bc) return ac - bc;
  const ap = Number(a.priority ?? 999);
  const bp = Number(b.priority ?? 999);
  if (ap !== bp) return ap - bp;
  const ai = Number(a.flowIndex ?? FLOW_INDEX_BY_TYPE[a.defaultNodeType || a.id?.replace(/^node:/, '')] ?? 9999);
  const bi = Number(b.flowIndex ?? FLOW_INDEX_BY_TYPE[b.defaultNodeType || b.id?.replace(/^node:/, '')] ?? 9999);
  if (ai !== bi) return ai - bi;
  return String(a.id || '').localeCompare(String(b.id || ''));
}

/** @param {ReadonlyArray<{ type: string }>} rows */
export function sortCatalogByFlowOrder(rows) {
  return [...rows].sort((a, b) => {
    const ma = getAiogram3BlockFlowMeta(a.type);
    const mb = getAiogram3BlockFlowMeta(b.type);
    if (!ma && !mb) return 0;
    if (!ma) return 1;
    if (!mb) return -1;
    return compareAiogram3PaletteEntries(
      { categoryOrder: ma.categoryOrder, priority: ma.priority, flowIndex: ma.flowIndex, id: a.type },
      { categoryOrder: mb.categoryOrder, priority: mb.priority, flowIndex: mb.flowIndex, id: b.type },
    );
  });
}

export function isAiogram3EntrypointType(type) {
  return getAiogram3BlockFlowMeta(type)?.flowRole === 'entrypoint';
}

export function isAiogram3OutputType(type) {
  return getAiogram3BlockFlowMeta(type)?.flowRole === 'output';
}

export function isAiogram3FsmType(type) {
  return getAiogram3BlockFlowMeta(type)?.flowRole === 'fsm';
}
