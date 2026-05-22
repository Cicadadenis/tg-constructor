/**
 * Graph UI palette — builds PaletteEntryV2[] from operation metadata + block catalog.
 * All Sidebar / compile UI paths go through this module (palette-core).
 */

import { AIOGRAM3_RUNTIME, isAiogram3Runtime } from '../../../core/aiogram3Runtime.js';
import {
  AIOGRAM3_FLOW_SECTIONS,
  AIOGRAM3_TOOLS_CATEGORY_ORDER,
  compareAiogram3PaletteEntries,
  getAiogram3BlockFlowMeta,
  getAiogram3FlowSection,
  sortCatalogByFlowOrder,
} from '../../../core/aiogram3PaletteOrder.js';
import { RU_GROUP_TO_ID } from '../../builderI18n.js';
import { listGraphUiNodeCatalogRows } from './graph_ui_node_metadata.js';
import {
  GRAPH_UI_OPERATION_METADATA,
  compileAddNewStack,
  compileAddBlockToStack,
  compileRemoveNode,
  compileUpdateNodeData,
} from './graph_ui_compositions.js';
import {
  createPaletteEntryV2,
  getPaletteEntryDisplay,
  GRAPH_PALETTE_CATEGORY_ORDER,
  isPaletteEntryDraggable,
  isPaletteInteractionDraggable,
  PALETTE_CATEGORY_FALLBACK,
  PALETTE_MAIN_EXTRA_SECTION,
  PALETTE_NODE_CATEGORIES,
  PALETTE_SIDEBAR_CATEGORY_IDS,
  PALETTE_SIDEBAR_CATEGORY_ORDER,
  PALETTE_TOOLS_CATEGORIES,
  paletteSidebarSectionOrder,
  validatePaletteEntryV2,
} from './palette_core.js';

export { GRAPH_UI_OPERATION_METADATA };
export {
  createPaletteEntryV2,
  getPaletteEntryDisplay,
  GRAPH_PALETTE_CATEGORY_ORDER,
  isPaletteEntryDraggable,
  isPaletteInteractionDraggable,
  PALETTE_CATEGORY_FALLBACK,
  PALETTE_MAIN_EXTRA_SECTION,
  PALETTE_NODE_CATEGORIES,
  PALETTE_SIDEBAR_CATEGORY_IDS,
  PALETTE_SIDEBAR_CATEGORY_ORDER,
  PALETTE_TOOLS_CATEGORIES,
  paletteSidebarSectionOrder,
  validatePaletteEntryV2,
} from './palette_core.js';

/**
 * Strict RU (and alias) → canonical sidebar category id.
 * Values MUST be members of PALETTE_SIDEBAR_CATEGORY_IDS.
 */
export const CATEGORY_MAP = Object.freeze({
  ...RU_GROUP_TO_ID,
  Система: 'system_root',
  'Ядро aiogram': 'core_framework',
  'Точки входа': 'entry_points',
  'Управление потоком': 'control_flow',
  'Состояние (FSM)': 'fsm',
  'Ответ Telegram': 'output',
  Медиа: 'media_output',
  Настройки: 'system_root',
  Основные: 'entry_points',
  Логика: 'control_flow',
  Действия: 'control_flow',
  Граф: 'graph',
  Graph: 'graph',
  Связи: 'relations',
  Relations: 'relations',
  Данные: 'data',
  Data: 'data',
});

const SIDEBAR_CATEGORY_SET = new Set(PALETTE_SIDEBAR_CATEGORY_IDS);

const COMPILE_BY_NAME = Object.freeze({
  compileAddNewStack,
  compileAddBlockToStack,
  compileRemoveNode,
  compileUpdateNodeData,
});

const categoryWarnedKeys = new Set();
const paletteDebugLoggedKeys = new Set();

/** @returns {boolean} */
export function isPaletteDebugEnabled() {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    return true;
  }
  try {
    return Boolean(import.meta?.env?.DEV);
  } catch {
    return false;
  }
}

/** @param {object} entry */
export function paletteEntryDedupeKey(entry) {
  if (entry?.type === 'node') {
    return `node:${entry.defaultNodeType}:${entry.category}`;
  }
  return `op:${entry?.id || ''}`;
}

function entryGroupLabel(entry) {
  return entry?.meta?.categoryLabel || entry?.categoryLabel || '';
}

/**
 * @param {object} entry
 * @param {object} [overrides]
 */
export function buildPaletteDebugInfo(entry, overrides = {}) {
  const rawCategory = overrides.rawCategory
    ?? entry?._paletteRawCategory
    ?? entry?.category
    ?? '';
  const resolved = resolvePaletteCategory(
    entry?.category,
    entryGroupLabel(entry),
    entry?.id,
  );
  const normalizedCategory = overrides.normalizedCategory
    ?? entry?._debug?.normalizedCategory
    ?? resolved.category;
  const finalCategory = overrides.finalCategory
    ?? entry?._debug?.finalCategory
    ?? entry?.category
    ?? normalizedCategory;
  const section = overrides.section ?? entry?._debug?.section ?? finalCategory;
  const movedToFallback = Boolean(
    overrides.movedToFallback
    ?? entry?._debug?.movedToFallback
    ?? section === PALETTE_MAIN_EXTRA_SECTION,
  );
  return {
    id: entry?.id || '',
    type: entry?.type || '',
    paletteKind: entry?.paletteKind || '',
    rawCategory: String(rawCategory),
    normalizedCategory,
    finalCategory,
    section,
    movedToFallback,
    dedupeKey: overrides.dedupeKey ?? paletteEntryDedupeKey(entry),
    normalizeReason: overrides.normalizeReason ?? entry?._debug?.normalizeReason ?? resolved.reason,
    mainExtraReason: overrides.mainExtraReason ?? entry?._debug?.mainExtraReason ?? null,
  };
}

/** @param {object} debug */
export function logPaletteDebugEntry(debug) {
  if (!isPaletteDebugEnabled() || !debug?.id) return;
  const key = `${debug.id}:${debug.section}:${debug.finalCategory}`;
  if (paletteDebugLoggedKeys.has(key)) return;
  paletteDebugLoggedKeys.add(key);
  console.warn(
    `[palette-debug] ${debug.id} → raw=${debug.rawCategory} → normalized=${debug.normalizedCategory} → final=${debug.finalCategory} → section=${debug.section}`
    + (debug.movedToFallback ? ` (main_extra:${debug.mainExtraReason || 'fallback'})` : ''),
  );
}

/** @param {object} entry @param {object} patch */
function stampPaletteEntryDebug(entry, patch) {
  if (!isPaletteDebugEnabled() || !entry) return;
  const next = buildPaletteDebugInfo(entry, { ...entry._debug, ...patch });
  entry._debug = next;
  logPaletteDebugEntry(next);
}

function warnPaletteCategoryMismatch(entryId, rawCategory, normalized) {
  const key = `${entryId}:${rawCategory}->${normalized}`;
  if (categoryWarnedKeys.has(key)) return;
  categoryWarnedKeys.add(key);
  console.warn(
    `[palette-category-mismatch] entry.id=${entryId} entry.category=${rawCategory} normalized=${normalized}`,
  );
}

/**
 * @param {string} [category]
 * @param {string} [groupLabel]
 * @param {string} [entryId]
 * @returns {{ category: string, reason: 'mapped' | 'unknown-fallback' }}
 */
export function resolvePaletteCategory(category, groupLabel, entryId) {
  const raw = String(category || '').trim();
  const label = String(groupLabel || '').trim();

  if (raw && SIDEBAR_CATEGORY_SET.has(raw)) {
    return { category: raw, reason: 'mapped' };
  }

  const fromRaw = raw && CATEGORY_MAP[raw];
  if (fromRaw && SIDEBAR_CATEGORY_SET.has(fromRaw)) {
    return { category: fromRaw, reason: 'mapped' };
  }

  const fromLabel = label && CATEGORY_MAP[label];
  if (fromLabel && SIDEBAR_CATEGORY_SET.has(fromLabel)) {
    return { category: fromLabel, reason: 'mapped' };
  }

  if (raw || label) {
    warnPaletteCategoryMismatch(entryId || '?', raw || label, PALETTE_CATEGORY_FALLBACK);
  }

  return { category: PALETTE_CATEGORY_FALLBACK, reason: 'unknown-fallback' };
}

/** @param {string} [category] @param {string} [groupLabel] @param {string} [entryId] */
export function normalizePaletteCategory(category, groupLabel, entryId) {
  return resolvePaletteCategory(category, groupLabel, entryId).category;
}

function resolveMainExtraReason(entry, gid, baseSet) {
  const normReason = entry?._debug?.normalizeReason
    ?? resolvePaletteCategory(entry.category, entryGroupLabel(entry), entry.id).reason;
  if (normReason === 'unknown-fallback') return 'unknown-category';
  if (!baseSet.has(gid)) return 'missing-section';
  return 'fallback';
}

function sealPaletteEntry(entry) {
  if (isPaletteDebugEnabled()) {
    stampPaletteEntryDebug(entry, {
      rawCategory: entry._paletteRawCategory ?? entry.category,
      normalizedCategory: entry.category,
      finalCategory: entry.category,
      section: entry.category,
      movedToFallback: false,
      mainExtraReason: null,
    });
    return entry;
  }
  return Object.freeze(entry);
}

function labelFor(meta, lang) {
  const labels = meta.label || {};
  return labels[lang] || labels.ru || labels.en || meta.paletteId || '';
}

function categoryLabelForSection(category, lang) {
  const flow = getAiogram3FlowSection(category);
  if (flow?.label) {
    return flow.label[lang] || flow.label.ru || category;
  }
  const map = {
    ru: {
      graph: 'Граф', relations: 'Связи', data: 'Данные', main_extra: 'Прочее',
    },
    en: {
      graph: 'Graph', relations: 'Relations', data: 'Data', main_extra: 'Other',
    },
    uk: {
      graph: 'Граф', relations: "Зв'язки", data: 'Дані', main_extra: 'Інше',
    },
  };
  return map[lang]?.[category] || map.ru[category] || category;
}

function resolveBlockCatalog(blockTypes) {
  const rows = Array.isArray(blockTypes) && blockTypes.length > 0
    ? blockTypes
    : listGraphUiNodeCatalogRows();
  const filtered = rows.filter((b) => isAiogram3Runtime(b.runtime));
  return sortCatalogByFlowOrder(filtered);
}

function sortPaletteEntries(entries) {
  return [...entries].sort(compareAiogram3PaletteEntries);
}

function buildOperationPaletteEntries(lang = 'ru') {
  const entries = [];
  const ops = Object.entries(GRAPH_UI_OPERATION_METADATA)
    .filter(([, meta]) => isAiogram3Runtime(meta?.runtime) && meta?.showInPalette && meta.paletteId)
    .sort(([, a], [, b]) => {
      const ac = a.categoryOrder ?? AIOGRAM3_TOOLS_CATEGORY_ORDER[a.category] ?? 99;
      const bc = b.categoryOrder ?? AIOGRAM3_TOOLS_CATEGORY_ORDER[b.category] ?? 99;
      if (ac !== bc) return ac - bc;
      return (a.priority ?? 99) - (b.priority ?? 99);
    });

  for (const [operationType, meta] of ops) {
    const rawCategory = meta.category || 'graph';
    const { category, reason } = resolvePaletteCategory(rawCategory, undefined, meta.paletteId);
    const entry = createPaletteEntryV2({
      id: meta.paletteId,
      type: 'operation',
      runtime: AIOGRAM3_RUNTIME,
      operationType,
      paletteKind: 'tool',
      label: labelFor(meta, lang),
      category,
      categoryOrder: meta.categoryOrder ?? AIOGRAM3_TOOLS_CATEGORY_ORDER[category] ?? 7,
      priority: meta.priority ?? 0,
      interaction: meta.interaction || 'click',
      compileFn: meta.compileFn,
      alternateCompileFn: meta.alternateCompileFn,
      defaultNodeType: meta.defaultNodeType,
      meta: {
        icon: meta.icon || '•',
        color: meta.color || '#94a3b8',
        categoryLabel: categoryLabelForSection(category, lang),
      },
      _paletteRawCategory: rawCategory,
      _debug: isPaletteDebugEnabled() ? { normalizeReason: reason } : undefined,
    });
    entries.push(sealPaletteEntry(entry));
  }
  return entries;
}

/** @param {ReadonlyArray} blockTypes */
function buildNodePaletteEntries(blockTypes, lang = 'ru') {
  const catalog = resolveBlockCatalog(blockTypes);
  const entries = [];
  const seenKeys = new Set();

  for (const b of catalog) {
    const blockType = String(b.type || '').trim();
    if (!blockType) continue;

    const flow = getAiogram3BlockFlowMeta(blockType);
    if (!flow) continue;

    const category = flow.section;
    const dedupeKey = `node:${blockType}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    const entry = createPaletteEntryV2({
      id: `node:${blockType}`,
      type: 'node',
      runtime: b.runtime || AIOGRAM3_RUNTIME,
      operationType: 'AddNode',
      defaultNodeType: blockType,
      paletteKind: 'node',
      label: b.label || blockType,
      category,
      categoryOrder: flow.categoryOrder,
      priority: flow.priority,
      flowRole: flow.flowRole,
      flowIndex: flow.flowIndex,
      interaction: 'drag',
      compileFn: 'compileAddNewStack',
      alternateCompileFn: 'compileAddBlockToStack',
      meta: {
        icon: b.icon || '•',
        color: b.color || '#94a3b8',
        categoryLabel: categoryLabelForSection(category, lang),
        canBeRoot: b.canBeRoot,
        canStack: b.canStack,
      },
      _paletteRawCategory: category,
      _debug: isPaletteDebugEnabled() ? { normalizeReason: 'flow-order' } : undefined,
    });
    entries.push(sealPaletteEntry(entry));
  }

  return sortPaletteEntries(entries);
}

/**
 * @param {string} [lang]
 * @param {{ blockTypes?: ReadonlyArray }} [options]
 * @returns {ReadonlyArray<import('./palette_core.js').PaletteEntryV2>}
 */
export function buildGraphUiPalette(lang = 'ru', options = {}) {
  const operations = buildOperationPaletteEntries(lang);
  const nodes = buildNodePaletteEntries(options.blockTypes, lang);
  const palette = sortPaletteEntries([...nodes, ...operations]);
  if (isPaletteDebugEnabled()) {
    for (const entry of palette) {
      stampPaletteEntryDebug(entry, {
        rawCategory: entry._paletteRawCategory ?? entry.category,
        normalizedCategory: entry.category,
        finalCategory: entry.category,
        section: entry.category,
        movedToFallback: false,
        mainExtraReason: null,
      });
    }
  }
  return isPaletteDebugEnabled() ? palette : Object.freeze(palette);
}

/**
 * @param {ReadonlyArray} palette
 * @param {ReadonlyArray<string>} [sectionOrderIn]
 */
export function groupPaletteForSidebar(palette, sectionOrderIn) {
  const baseOrder = sectionOrderIn?.length
    ? [...sectionOrderIn]
    : paletteSidebarSectionOrder();
  const baseSet = new Set(baseOrder);

  const byCategory = {};
  for (const entry of palette || []) {
    const raw = entry.category;
    const gid = normalizePaletteCategory(raw, entryGroupLabel(entry), entry.id);
    if (isPaletteDebugEnabled()) {
      const rawForDebug = entry._paletteRawCategory ?? raw;
      const { category: normalized, reason } = resolvePaletteCategory(
        rawForDebug,
        entryGroupLabel(entry),
        entry.id,
      );
      stampPaletteEntryDebug(entry, {
        rawCategory: rawForDebug,
        normalizedCategory: normalized,
        normalizeReason: reason,
      });
    }
    if (!byCategory[gid]) byCategory[gid] = [];
    byCategory[gid].push(entry);
  }

  const groups = {};
  const mainExtra = [];

  for (const [gid, entries] of Object.entries(byCategory)) {
    const sortedEntries = sortPaletteEntries(entries);
    if (baseSet.has(gid)) {
      groups[gid] = sortedEntries;
      if (isPaletteDebugEnabled()) {
        for (const entry of entries) {
          stampPaletteEntryDebug(entry, {
            finalCategory: gid,
            section: gid,
            movedToFallback: false,
            mainExtraReason: null,
          });
        }
      }
    } else {
      for (const entry of entries) {
        warnPaletteCategoryMismatch(entry.id, gid, PALETTE_MAIN_EXTRA_SECTION);
        if (isPaletteDebugEnabled()) {
          const mainExtraReason = resolveMainExtraReason(entry, gid, baseSet);
          stampPaletteEntryDebug(entry, {
            finalCategory: PALETTE_MAIN_EXTRA_SECTION,
            section: PALETTE_MAIN_EXTRA_SECTION,
            movedToFallback: true,
            mainExtraReason,
          });
        }
      }
      mainExtra.push(...sortedEntries);
    }
  }

  if (mainExtra.length) {
    groups[PALETTE_MAIN_EXTRA_SECTION] = mainExtra;
  }

  const sectionOrder = baseOrder.filter((g) => groups[g]?.length);
  if (groups[PALETTE_MAIN_EXTRA_SECTION]?.length) {
    sectionOrder.push(PALETTE_MAIN_EXTRA_SECTION);
  }

  const accounted = sectionOrder.reduce((n, g) => n + (groups[g]?.length || 0), 0);
  const total = (palette || []).length;
  if (accounted !== total) {
    console.warn(
      `[graph_ui_palette] Sidebar grouping mismatch: ${total} entries, ${accounted} grouped.`,
    );
  }

  return { groups, sectionOrder };
}

/** @param {ReadonlyArray} palette @param {object} [options] */
export function assertPaletteIntegrity(palette, options = {}) {
  const minOps = options.minOperations ?? 1;
  const minNodes = options.minNodes ?? 1;
  const warnings = [];

  const list = palette || [];
  const operations = list.filter((e) => e.type === 'operation');
  const nodes = list.filter((e) => e.type === 'node');

  if (operations.length < minOps) {
    warnings.push(`expected >= ${minOps} operation entries, got ${operations.length}`);
  }
  if (nodes.length < minNodes) {
    warnings.push(`expected >= ${minNodes} node entries, got ${nodes.length}`);
  }

  for (const entry of list) {
    const shapeErrors = validatePaletteEntryV2(entry);
    if (shapeErrors.length) {
      warnings.push(`${entry.id}: ${shapeErrors.join(', ')}`);
    }
  }

  const { groups, sectionOrder } = groupPaletteForSidebar(list);
  const grouped = sectionOrder.reduce((n, g) => n + (groups[g]?.length || 0), 0);
  if (grouped !== list.length) {
    warnings.push(`Sidebar would show ${grouped}/${list.length} entries`);
  }

  for (const msg of warnings) {
    console.warn(`[graph_ui_palette] Palette integrity: ${msg}`);
  }

  return {
    ok: warnings.length === 0,
    warnings,
    operations: operations.length,
    nodes: nodes.length,
    sections: sectionOrder.length,
  };
}

/** @param {string} paletteId */
export function getPaletteEntry(paletteId, options = {}) {
  const id = String(paletteId || '').trim();
  const lang = options.lang || 'ru';
  return buildGraphUiPalette(lang, options).find((e) => e.id === id) || null;
}

/** @param {string} operationType */
export function getPaletteEntryByOperation(operationType, options = {}) {
  const meta = GRAPH_UI_OPERATION_METADATA[operationType];
  if (!meta?.paletteId) return null;
  return getPaletteEntry(meta.paletteId, options);
}

function resolveOperationCompilePlan(entry) {
  const opMeta = GRAPH_UI_OPERATION_METADATA[entry.operationType];
  if (!opMeta) return null;
  return {
    compileFn: entry.compileFn || opMeta.compileFn,
    alternateCompileFn: entry.alternateCompileFn || opMeta.alternateCompileFn,
  };
}

/**
 * Compile palette gesture → canonical operation specs (compiler layer only).
 */
export function compilePaletteAction(entry, context = {}) {
  if (!entry) {
    return { ok: false, error: 'Unknown palette entry' };
  }

  if (entry.type === 'node') {
    if (!context.block) {
      return { ok: false, error: 'AddNode compile requires block in context' };
    }
    if (context.stackId) {
      return compileAddBlockToStack(context.stacks, context.stackId, context.block);
    }
    return compileAddNewStack(context.x, context.y, context.block);
  }

  if (entry.type === 'operation') {
    const plan = resolveOperationCompilePlan(entry);
    if (!plan?.compileFn) {
      return { ok: false, error: `Palette entry has no compile path: ${entry.id}` };
    }

    const compileName = context.stackId && plan.alternateCompileFn
      ? plan.alternateCompileFn
      : plan.compileFn;
    const compile = COMPILE_BY_NAME[compileName];
    if (typeof compile !== 'function') {
      return { ok: false, error: `Unhandled compile: ${compileName}` };
    }

    if (compileName === 'compileAddNewStack') {
      return compile(context.x, context.y, context.block);
    }
    if (compileName === 'compileAddBlockToStack') {
      return compile(context.stacks, context.stackId, context.block);
    }
    if (compileName === 'compileRemoveNode') {
      return compile(context.nodeId);
    }
    if (compileName === 'compileUpdateNodeData') {
      return compile(context.nodeId, context.data || {}, context.meta);
    }
    return { ok: false, error: `Unhandled compile: ${compileName}` };
  }

  return { ok: false, error: `Unknown palette entry type: ${entry.type}` };
}

/** @param {ReadonlyArray} paletteEntries */
export function assertPaletteFlowOrder(paletteEntries) {
  const nodes = (paletteEntries || []).filter((e) => e.type === 'node');
  for (let i = 1; i < nodes.length; i += 1) {
    const prev = nodes[i - 1];
    const cur = nodes[i];
    if (compareAiogram3PaletteEntries(prev, cur) > 0) {
      throw new Error(
        `Palette flow order violation: ${prev.id} (section ${prev.category}) before ${cur.id} (section ${cur.category})`,
      );
    }
  }
  const entryNodes = nodes.filter((e) => e.flowRole === 'entrypoint');
  const outputNodes = nodes.filter((e) => e.flowRole === 'output');
  if (entryNodes.length && outputNodes.length) {
    const maxEntry = Math.max(...entryNodes.map((e) => e.categoryOrder ?? 0));
    const minOutput = Math.min(...outputNodes.map((e) => e.categoryOrder ?? 99));
    if (maxEntry >= minOutput) {
      throw new Error('Entrypoint blocks must be ordered before output blocks in palette');
    }
  }
}

/** @param {ReadonlyArray} paletteEntries */
export function assertPaletteContract(paletteEntries) {
  for (const entry of paletteEntries || []) {
    const errors = validatePaletteEntryV2(entry);
    if (errors.length) {
      throw new Error(`PaletteEntryV2 ${entry?.id}: ${errors.join('; ')}`);
    }
    if (!isAiogram3Runtime(entry.runtime)) {
      throw new Error(`PaletteEntryV2 ${entry?.id}: runtime must be aiogram3`);
    }
  }
  assertPaletteFlowOrder(paletteEntries);
}

/** @deprecated use assertPaletteContract */
export function assertPaletteDerivedOnly(entries) {
  return assertPaletteContract(entries);
}
