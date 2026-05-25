/**
 * Deterministic AI flow assist — suggestions, repair, optimize, branches (no LLM).
 */

import { getCompatibleBlockTypes, getBlockDefaultProps } from '../blockRegistry.js';
import { graphResolveNodeType } from '../../src/constructor/graph_document/graph_node_payload.js';
import { validateGraphSemantics } from '../../src/constructor/graph_document/operation_registry.js';
import { runGraphValidationPipeline } from '../../src/constructor/graph_document/graph_validation_pipeline.js';
import { repairGraphIssues, getRepairCapabilities } from '../../src/constructor/graph_document/graph_auto_repair.js';
import { buildStructuredFlowPlan, detectFlowNiche, expandFlowPrompt } from './flowIntentExtensions.mjs';

const NEXT_BLOCK_HEURISTICS = Object.freeze({
  start: ['message', 'buttons', 'command'],
  message: ['buttons', 'inline', 'condition', 'delay', 'ask'],
  buttons: ['callback', 'condition', 'message'],
  callback: ['message', 'condition', 'ask', 'goto'],
  ask: ['remember', 'condition', 'message'],
  condition: ['message', 'buttons', 'delay'],
  delay: ['message', 'buttons'],
  command: ['message', 'buttons'],
});

/**
 * @param {object} document
 * @param {string | null} selectedNodeId
 */
export function suggestFlowNodes(document, selectedNodeId = null) {
  const nodes = document?.nodes || {};
  const suggestions = [];
  const anchor = selectedNodeId && nodes[selectedNodeId]
    ? nodes[selectedNodeId]
    : Object.values(nodes).find((n) => graphResolveNodeType(n) === 'start')
      || Object.values(nodes)[0];

  if (!anchor) {
    return [
      { type: 'start', label: 'Старт', reason: 'Точка входа в сценарий' },
      { type: 'message', label: 'Сообщение', reason: 'Первое приветствие' },
      { type: 'buttons', label: 'Кнопки', reason: 'Меню действий' },
    ];
  }

  const anchorType = graphResolveNodeType(anchor);
  const compatible = getCompatibleBlockTypes(anchorType) || NEXT_BLOCK_HEURISTICS[anchorType] || ['message', 'buttons'];

  for (const type of compatible.slice(0, 6)) {
    suggestions.push({
      type,
      label: type,
      reason: `Совместимо после «${anchorType}»`,
      props: getBlockDefaultProps(type) || {},
    });
  }

  if (anchorType === 'message' && !compatible.includes('delay')) {
    suggestions.push({ type: 'delay', label: 'delay', reason: 'Пауза перед следующим шагом', props: { seconds: '2' } });
  }
  if (!['condition', 'switch'].includes(anchorType)) {
    suggestions.push({
      type: 'condition',
      label: 'condition',
      reason: 'Ветвление по ответу пользователя',
      props: { cond: 'текст == "да"' },
    });
  }

  return dedupeSuggestions(suggestions).slice(0, 8);
}

/**
 * @param {object} document
 * @param {string | null} selectedNodeId
 */
export function autocompleteFlowStep(document, selectedNodeId = null) {
  const suggestions = suggestFlowNodes(document, selectedNodeId);
  const primary = suggestions[0];
  return {
    suggestedNext: primary,
    alternatives: suggestions.slice(1, 5),
    connections: primary
      ? [{ from: selectedNodeId, to: null, sourcePort: 'flow', targetPort: 'flow' }]
      : [],
  };
}

/**
 * @param {object} document
 */
export function buildOptimizationHints(document) {
  const hints = [];
  const semantics = validateGraphSemantics(document);
  if (!semantics.ok) {
    for (const issue of (semantics.issues || []).slice(0, 6)) {
      hints.push({
        severity: 'warning',
        code: issue.code || 'SEMANTICS',
        message: issue.message,
        nodeId: issue.nodeId,
      });
    }
  }

  const pipeline = runGraphValidationPipeline(document, { strict: false });
  for (const issue of (pipeline.displayErrors || pipeline.errors || []).slice(0, 5)) {
    hints.push({
      severity: 'error',
      code: issue.code || 'VALIDATION',
      message: issue.message || issue.title,
      nodeId: issue.nodeId,
    });
  }

  const nodeCount = Object.keys(document?.nodes || {}).length;
  const edgeCount = Object.keys(document?.edges || {}).length;
  if (nodeCount > 40) {
    hints.push({
      severity: 'info',
      code: 'PERF_LARGE_GRAPH',
      message: 'Большой сценарий — используйте условия и под-сценарии для читаемости.',
    });
  }
  if (edgeCount < nodeCount - 1 && nodeCount > 3) {
    hints.push({
      severity: 'info',
      code: 'DISCONNECTED_NODES',
      message: 'Есть изолированные узлы — проверьте связи между шагами.',
    });
  }

  const hasDelay = Object.values(document?.nodes || {}).some((n) => graphResolveNodeType(n) === 'delay');
  if (nodeCount > 5 && !hasDelay) {
    hints.push({
      severity: 'info',
      code: 'UX_ADD_DELAY',
      message: 'Добавьте delay между сообщениями — UX будет естественнее.',
    });
  }

  return hints;
}

/**
 * @param {object} document
 */
export function repairFlowGraph(document) {
  const report = repairGraphIssues(document, { lang: 'ru' });
  const pipeline = runGraphValidationPipeline(document, { strict: false });
  const capabilities = getRepairCapabilities(pipeline.diagnostics || [], document);
  return {
    ok: report.ok,
    fixes: report.fixes || [],
    operations: report.operations || [],
    highlights: report.highlights || {},
    diagnostics: report.remainingDiagnostics || [],
    steps: report.steps || [],
    capabilities,
  };
}

/**
 * @param {object} document
 * @param {string} nodeId
 */
export function suggestFlowBranches(document, nodeId) {
  const node = document?.nodes?.[nodeId];
  if (!node) {
    return { branches: [], message: 'Выберите узел для ветвления' };
  }
  const type = graphResolveNodeType(node);
  const branches = [];

  if (type === 'condition' || type === 'switch') {
    branches.push(
      { port: 'true', label: 'Да / совпадение', suggestion: 'message с подтверждением' },
      { port: 'false', label: 'Нет / иначе', suggestion: 'альтернативный путь или повтор' },
    );
  } else {
    branches.push(
      { port: 'flow', label: 'Основной путь', suggestion: 'message → buttons' },
      { port: 'flow', label: 'Ветка «отказ»', suggestion: 'condition → fallback message' },
      { port: 'flow', label: 'Ветка «повтор»', suggestion: 'goto к предыдущему шагу' },
    );
  }

  if (type === 'buttons' || type === 'inline') {
    branches.push({ port: 'keyboard', label: 'Callback handler', suggestion: 'callback узел на каждую кнопку' });
  }

  return { nodeId, nodeType: type, branches };
}

/**
 * Rule-based copywriting (LLM layer may override in service).
 * @param {string} text
 * @param {{ tone?: string, niche?: string }} [ctx]
 */
const FLOW_NICHE_CUSTOM = 'custom';

export function suggestCopywriting(text, ctx = {}) {
  const raw = String(text || '').trim();
  const niche = ctx.niche || FLOW_NICHE_CUSTOM;
  const tone = ctx.tone || 'friendly';

  const templates = {
    salon_funnel: {
      greeting: '✨ Добро пожаловать в наш салон! Выберите услугу или запишитесь к мастеру.',
      confirm: 'Отлично! Ваша запись подтверждена. Ждём вас в выбранное время 💇',
      reminder: 'Напоминаем о визите завтра. Нужно перенести? Напишите нам.',
    },
    onboarding: {
      greeting: '👋 Рады видеть вас! За 2 минуты покажем, как получить максимум от продукта.',
      step: 'Отличный прогресс! Остался один шаг до полного доступа.',
      success: '🎉 Готово! Теперь можно пользоваться всеми функциями.',
    },
  };

  const pack = templates[niche] || templates.onboarding;
  let suggestion = raw;

  if (!raw || raw.length < 8) {
    suggestion = pack.greeting;
  } else if (includesConfirm(raw)) {
    suggestion = polishLine(raw, tone) || pack.confirm;
  } else {
    suggestion = polishLine(raw, tone);
  }

  return {
    original: raw,
    suggestion,
    variants: [
      suggestion,
      `${suggestion} ${tone === 'formal' ? '' : '🙂'}`.trim(),
      shorterVariant(suggestion),
    ].filter(Boolean),
  };
}

function includesConfirm(text) {
  return /подтверж|запис|успеш|готово|спасибо/i.test(text);
}

function polishLine(text, tone) {
  let s = text.replace(/\s+/g, ' ').trim();
  if (tone === 'formal') {
    s = s.replace(/ты/gi, 'Вы').replace(/тебя/gi, 'Вас');
  }
  if (!/[.!?]$/.test(s)) s += '.';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function shorterVariant(text) {
  if (text.length < 80) return text;
  return `${text.slice(0, 77).trim()}…`;
}

function dedupeSuggestions(list) {
  const seen = new Set();
  return list.filter((s) => {
    const k = s.type;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export { buildStructuredFlowPlan, detectFlowNiche, expandFlowPrompt };
