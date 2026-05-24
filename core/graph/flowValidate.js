/**
 * Flow graph validation — studio IR (no DSL parser).
 */
import { FLOW_PORTS } from './flowPorts.js';
import { validateProjectIr } from '../ir/validateProjectIr.js';
import { validateAiogram3Graph } from '../rules/aiogram3RuleEngine.js';
import {
  resolveFlowNodeType,
  resolveFlowNodeProps,
  resolveFlowNodeLabel,
} from '../ir/resolveFlowNodeType.js';

function portFor(blockType, dir) {
  const cfg = FLOW_PORTS[blockType] || { input: 'flow', output: 'flow' };
  return dir === 'in' ? cfg.input : cfg.output;
}

export function validateFlow(flow) {
  const ir = validateProjectIr(flow);
  const rules = validateAiogram3Graph(flow);
  const errors = [
    ...ir.errors,
    ...rules.errors.map((e) => e.message),
  ];
  const warnings = [
    ...ir.warnings,
    ...rules.warnings.map((w) => w.message),
  ];
  const nodes = flow?.nodes || [];
  const edges = flow?.edges || [];
  const idset = new Set(nodes.map((n) => n.id));
  const blockType = (n) => resolveFlowNodeType(n);
  const blockProps = (n) => resolveFlowNodeProps(n);
  const blockLabel = (n) => resolveFlowNodeLabel(n);

  for (const e of edges) {
    if (!idset.has(e.source) || !idset.has(e.target)) {
      errors.push(`Ребро ${e.id || 'без id'}: неизвестный source/target`);
    }
  }

  if (nodes.length === 0) {
    warnings.push('Холст пуст — добавь блоки');
    return { errors, warnings };
  }

  const startNodes = nodes.filter((n) => blockType(n) === 'start');
  if (startNodes.length === 0) warnings.push('Нет блока «Старт»');
  if (startNodes.length > 1) warnings.push(`Несколько блоков «Старт» (${startNodes.length})`);

  for (const n of nodes) {
    const t = blockType(n);
    const p = blockProps(n);
    if (t === 'message' && !String(p.text || '').trim()) {
      errors.push(`Блок «Ответ» [${n.id}]: пустой текст`);
    }
    if (t === 'bot' && !String(p.token || '').trim()) {
      warnings.push(`Блок «Бот» [${n.id}]: не указан токен`);
    }
    if (t === 'command' && !String(p.cmd || '').trim()) {
      errors.push(`Блок «Команда» [${n.id}]: не указана команда`);
    }
    const hasParent = edges.some((e) => e.target === n.id);
    const isRoot = ['start', 'command', 'callback', 'on_text', 'on_photo', 'scenario'].includes(t);
    if (!isRoot && !['version', 'bot', 'commands', 'global', 'block'].includes(t) && !hasParent) {
      warnings.push(`«${blockLabel(n)}» [${n.id}] не подключён к родителю`);
    }
  }

  return { errors, warnings };
}
