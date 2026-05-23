/**
 * Self-healing graph repair — detect / explain / repair registry.
 */

import { applyOperation, createOperation } from './graph_operations.js';
import { createGraphDocument } from './graph_document.js';
import { runGraphValidationPipeline } from './graph_validation_pipeline.js';
import { auditGraphCorruption } from './graph_state_repair.js';
import {
  repairDanglingEdges,
  repairDuplicateEdges,
  repairInvalidConnectionEdges,
  repairSelfLoopEdges,
} from './graph_edge_repair.js';
import { repairBrokenCallbacksInDocument } from './graph_callback_repair.js';
import { validateConnection } from './operation_registry.js';
import { beginRepairTransaction, dryRunRepairOperations } from './graph_repair_transaction.js';

/** @typedef {'critical'|'high'|'medium'|'manual'} RepairTier */

/**
 * @typedef {object} RepairAction
 * @property {string} id
 * @property {RepairTier} tier
 * @property {string[]} codes
 * @property {(ctx: RepairContext) => boolean} detect
 * @property {(ctx: RepairContext) => { ru: string, en: string }} explain
 * @property {(ctx: RepairContext) => RepairStepResult} repair
 * @property {boolean} [unsafe]
 */

/**
 * @typedef {object} RepairContext
 * @property {object} document
 * @property {object[]} diagnostics
 * @property {Set<string>} codes
 */

/**
 * @typedef {object} RepairStepResult
 * @property {object[]} operations
 * @property {object[]} fixes
 * @property {{ nodeIds?: string[], edgeIds?: string[], removedEdgeIds?: string[] }} [highlights]
 */

/**
 * @typedef {object} GraphRepairFix
 * @property {string} actionId
 * @property {string} code
 * @property {string} before
 * @property {string} after
 * @property {string[]} [nodeIds]
 * @property {string[]} [edgeIds]
 */

const TIER_ORDER = { critical: 0, high: 1, medium: 2, manual: 3 };

/** @type {RepairAction[]} */
export const REPAIR_ACTION_REGISTRY = [
  {
    id: 'dangling_edges',
    tier: 'critical',
    codes: ['dangling_edge', 'hydration_orphan_edges', 'invalid_edges'],
    detect: (ctx) => ctx.codes.has('dangling_edge')
      || ctx.codes.has('hydration_orphan_edges')
      || auditGraphCorruption(ctx.document).danglingEdges.length > 0,
    explain: () => ({
      ru: 'Удалить битые связи без узлов на концах',
      en: 'Remove broken links with missing endpoints',
    }),
    repair: (ctx) => {
      const r = repairDanglingEdges(ctx.document);
      return {
        operations: r.operations,
        fixes: r.removed.map((edgeId) => ({
          actionId: 'dangling_edges',
          code: 'dangling_edge',
          before: `Связь ${edgeId}`,
          after: 'Удалена',
          edgeIds: [edgeId],
        })),
        highlights: { removedEdgeIds: r.removed, edgeIds: r.removed },
      };
    },
  },
  {
    id: 'duplicate_edges',
    tier: 'critical',
    codes: ['duplicate_edge'],
    detect: (ctx) => ctx.codes.has('duplicate_edge'),
    explain: () => ({
      ru: 'Удалить дубликаты одинаковых связей',
      en: 'Remove duplicate identical connections',
    }),
    repair: (ctx) => {
      const r = repairDuplicateEdges(ctx.document);
      return {
        operations: r.operations,
        fixes: r.removed.map((edgeId) => ({
          actionId: 'duplicate_edges',
          code: 'duplicate_edge',
          before: `Дубликат ${edgeId}`,
          after: 'Удалён',
          edgeIds: [edgeId],
        })),
        highlights: { removedEdgeIds: r.removed },
      };
    },
  },
  {
    id: 'self_loops',
    tier: 'critical',
    codes: ['self_connection'],
    detect: (ctx) => ctx.codes.has('self_connection')
      || Object.values(ctx.document.edges || {}).some((e) => !e.invalid && e.source === e.target),
    explain: () => ({
      ru: 'Удалить петли «блок → сам себе»',
      en: 'Remove self-loop edges',
    }),
    repair: (ctx) => {
      const r = repairSelfLoopEdges(ctx.document);
      return {
        operations: r.operations,
        fixes: r.removed.map((edgeId) => ({
          actionId: 'self_loops',
          code: 'self_connection',
          before: `Петля ${edgeId}`,
          after: 'Удалена',
          edgeIds: [edgeId],
        })),
        highlights: { removedEdgeIds: r.removed },
      };
    },
  },
  {
    id: 'invalid_connections',
    tier: 'critical',
    codes: ['incompatible_connection', 'invalid_target_type', 'invalid_source_type', 'invalid_node_props'],
    detect: (ctx) => ctx.codes.has('incompatible_connection')
      || ctx.codes.has('invalid_target_type')
      || ctx.codes.has('invalid_source_type'),
    explain: () => ({
      ru: 'Удалить связи с несовместимыми портами',
      en: 'Remove links with incompatible ports',
    }),
    repair: (ctx) => {
      const r = repairInvalidConnectionEdges(ctx.document, validateConnection);
      return {
        operations: r.operations,
        fixes: r.removed.map((edgeId) => ({
          actionId: 'invalid_connections',
          code: 'incompatible_connection',
          before: `Недопустимая связь ${edgeId}`,
          after: 'Удалена',
          edgeIds: [edgeId],
        })),
        highlights: { removedEdgeIds: r.removed },
      };
    },
  },
  {
    id: 'broken_callbacks',
    tier: 'critical',
    codes: [
      'missing_handlers',
      'broken_callback_route',
      'invalid_callbacks',
      'MissingCallbackHandlerError',
      'CALLBACK_HANDLER_DISCONNECTED',
    ],
    detect: (ctx) => ['missing_handlers', 'broken_callback_route', 'invalid_callbacks', 'MissingCallbackHandlerError']
      .some((c) => ctx.codes.has(c)),
    explain: () => ({
      ru: 'Создать недостающие блоки «При нажатии» для inline-кнопок',
      en: 'Create missing On click handlers for inline buttons',
    }),
    repair: (ctx) => {
      const r = repairBrokenCallbacksInDocument(ctx.document);
      const newNodeIds = r.operations
        .filter((o) => o.type === 'AddNode')
        .map((o) => o.payload?.nodeId)
        .filter(Boolean);
      const newEdgeIds = r.operations
        .filter((o) => o.type === 'AddEdge')
        .map((o) => o.payload?.edgeId)
        .filter(Boolean);
      return {
        operations: r.operations,
        fixes: (r.fixes || []).map((f, i) => ({
          actionId: 'broken_callbacks',
          code: 'missing_handlers',
          before: f.before || 'Нет обработчика',
          after: f.after || 'Создан «При нажатии»',
          nodeIds: newNodeIds.slice(i, i + 1),
        })),
        highlights: { nodeIds: newNodeIds, edgeIds: newEdgeIds },
      };
    },
  },
  {
    id: 'ghost_selection',
    tier: 'medium',
    codes: ['ghost_selection'],
    detect: (ctx) => auditGraphCorruption(ctx.document).ghostSelectionIds.length > 0,
    explain: () => ({
      ru: 'Очистить выделение несуществующих узлов',
      en: 'Clear selection referencing deleted nodes',
    }),
    repair: (ctx) => {
      const audit = auditGraphCorruption(ctx.document);
      const nodeIds = new Set(Object.keys(ctx.document.nodes || {}));
      const selection = (ctx.document.ui_state?.selection || []).filter((id) => nodeIds.has(String(id)));
      const op = createOperation('UpdateUiState', { ui_state: { ...ctx.document.ui_state, selection } });
      return {
        operations: [op],
        fixes: audit.ghostSelectionIds.map((id) => ({
          actionId: 'ghost_selection',
          code: 'ghost_selection',
          before: `Выделение: ${id}`,
          after: 'Снято с холста',
          nodeIds: [id],
        })),
        highlights: { nodeIds: audit.ghostSelectionIds },
      };
    },
  },
  {
    id: 'stale_hydration',
    tier: 'medium',
    codes: ['hydration_orphan_edges'],
    detect: (ctx) => Number(ctx.document.metadata?.hydrationDiagnostics?.orphanEdgeCount) > 0,
    explain: () => ({
      ru: 'Сбросить устаревшие метаданные загрузки',
      en: 'Clear stale hydration metadata',
    }),
    repair: (ctx) => {
      const count = ctx.document.metadata?.hydrationDiagnostics?.orphanEdgeCount || 0;
      const op = createOperation('PatchMetadata', { clearHydration: true });
      return {
        operations: [op],
        fixes: [{
          actionId: 'stale_hydration',
          code: 'hydration_orphan_edges',
          before: `Записей загрузки: ${count}`,
          after: 'Метаданные очищены',
        }],
        highlights: {},
      };
    },
  },
];

/** Manual / AI strategy only — no automatic graph mutation */
export const MANUAL_REPAIR_STRATEGIES = Object.freeze({
  unreachable_node: {
    ru: 'Проверьте цепочку от «Старт» или удалите изолированный блок вручную.',
    en: 'Connect from Start or remove the isolated block manually.',
    aiNote: {
      ru: 'Автоудаление недостижимых узлов может сломать черновик — только подсказка.',
      en: 'Auto-deleting unreachable nodes may break drafts — suggestion only.',
    },
  },
  dead_end_branch: {
    ru: 'Добавьте «Ответ» или действие на конце ветки condition.',
    en: 'Add Reply or an action at the end of the condition branch.',
    aiNote: {
      ru: 'Для condition: подключите порты true/false к следующим шагам.',
      en: 'For condition: wire true/false ports to follow-up steps.',
    },
  },
  dead_end_chain: {
    ru: 'Продолжите цепочку после последнего блока.',
    en: 'Extend the chain after the last block.',
  },
  orphan_node: {
    ru: 'Соедините узел с потоком или удалите, если он лишний.',
    en: 'Connect the node to the flow or delete if unused.',
  },
  invalid_fsm_transition: {
    ru: 'Исправьте имя сценария/шага в goto/run.',
    en: 'Fix scenario/step name in goto/run.',
  },
  module_compose_conflict: {
    ru: 'Разрешите конфликт модулей: отключите один модуль или измените точки входа.',
    en: 'Resolve module conflict: disable a module or change entry wiring.',
    aiNote: {
      ru: 'При слиянии модулей проверьте callback namespace и глобальные имена.',
      en: 'When merging modules, check callback namespace and global names.',
    },
  },
});

/**
 * @param {string} code
 * @param {string} [lang]
 */
export function suggestRepairStrategy(code, lang = 'ru') {
  const entry = MANUAL_REPAIR_STRATEGIES[code];
  if (!entry) return null;
  return {
    strategy: entry[lang] || entry.ru,
    aiNote: entry.aiNote?.[lang] || entry.aiNote?.ru || null,
    autoFixAvailable: false,
  };
}

/**
 * @param {object} document
 * @param {object} [options]
 */
export function repairGraphIssues(document, options = {}) {
  const lang = options.lang || 'ru';
  const pipeline = options.pipeline || runGraphValidationPipeline(document, {
    strict: Boolean(options.strict),
    includeCallbacks: true,
    skipLegacy: true,
  });
  const diagnostics = pipeline.diagnostics || [];
  const codes = new Set(diagnostics.map((d) => d.code));

  const tx = beginRepairTransaction(document);
  let working = createGraphDocument(document);
  const allOperations = [];
  const allFixes = /** @type {GraphRepairFix[]} */ ([]);
  const highlights = {
    nodeIds: new Set(),
    edgeIds: new Set(),
    removedEdgeIds: new Set(),
    addedNodeIds: new Set(),
  };
  const steps = [];

  const sorted = [...REPAIR_ACTION_REGISTRY].sort(
    (a, b) => (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9),
  );

  for (const action of sorted) {
    const ctx = { document: working, diagnostics, codes };
    if (!action.detect(ctx)) continue;
    const result = action.repair(ctx);
    if (!result.operations?.length) continue;

    const dry = dryRunRepairOperations(tx, result.operations);
    if (!dry.ok) {
      steps.push({
        actionId: action.id,
        ok: false,
        error: dry.error,
        explain: action.explain(ctx)[lang] || action.explain(ctx).ru,
      });
      continue;
    }

    working = dry.document;
    allOperations.push(...result.operations);
    for (const f of result.fixes || []) allFixes.push(f);
    (result.highlights?.nodeIds || []).forEach((id) => highlights.nodeIds.add(id));
    (result.highlights?.edgeIds || []).forEach((id) => highlights.edgeIds.add(id));
    (result.highlights?.removedEdgeIds || []).forEach((id) => highlights.removedEdgeIds.add(id));
    result.operations
      .filter((o) => o.type === 'AddNode')
      .forEach((o) => highlights.addedNodeIds.add(o.payload?.nodeId));

    steps.push({
      actionId: action.id,
      ok: true,
      fixCount: result.fixes?.length || result.operations.length,
      explain: action.explain(ctx)[lang] || action.explain(ctx).ru,
    });

    // Refresh codes after mutation
    const nextPipe = runGraphValidationPipeline(working, {
      strict: false,
      includeCallbacks: true,
      skipLegacy: true,
    });
    nextPipe.diagnostics.forEach((d) => codes.add(d.code));
  }

  const autoFixable = REPAIR_ACTION_REGISTRY.flatMap((a) => a.codes);
  const remaining = diagnostics.filter(
    (d) => !autoFixable.includes(d.code) || (d.severity === 'error' && !steps.some((s) => s.ok && s.actionId)),
  );

  return {
    ok: allOperations.length > 0,
    transaction: tx,
    document: working,
    operations: allOperations,
    fixes: allFixes,
    steps,
    fixCount: allFixes.length,
    undoSteps: allOperations.length,
    highlights: {
      nodeIds: [...highlights.nodeIds, ...highlights.addedNodeIds],
      edgeIds: [...highlights.edgeIds],
      removedEdgeIds: [...highlights.removedEdgeIds],
      addedNodeIds: [...highlights.addedNodeIds],
    },
    remainingDiagnostics: remaining,
    manualCodes: [...new Set(remaining.map((d) => d.code))],
  };
}

/**
 * List repair capabilities for diagnostics UI.
 * @param {object[]} diagnostics
 */
export function getRepairCapabilities(diagnostics = [], document = null) {
  const codes = new Set(diagnostics.map((d) => d.code));
  const ctx = { document: document || { nodes: {}, edges: {} }, diagnostics, codes };
  const auto = REPAIR_ACTION_REGISTRY.filter((a) => a.detect(ctx));
  const manual = diagnostics
    .filter((d) => !auto.some((a) => a.codes.includes(d.code)))
    .map((d) => ({ code: d.code, ...suggestRepairStrategy(d.code) }))
    .filter((m) => m.strategy);

  return {
    autoFixable: auto.map((a) => a.id),
    manual,
    unsafe: REPAIR_ACTION_REGISTRY.filter((a) => a.unsafe).map((a) => a.id),
  };
}
