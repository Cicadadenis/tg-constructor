/**
 * Graph operation registry — graph-native semantic layer.
 *
 * Source of truth for:
 *  - inputs / outputs ports per node type (ConnectionRole + PortKind)
 *  - allowed connections matrix (canConnect)
 *  - inspector schema per node type (schema-driven editable fields)
 *  - validationRules per node type (zod-style payload guards)
 *
 * Stays read-only at runtime: contracts are derived from the central
 * blockRegistry / aiogram3 metadata. This is the "graph semantic layer"
 * that disappeared with the stack/legacy removal — restored without any
 * stack/segment vocabulary.
 *
 * Layer: UI compiler (composition input). Must NOT call dispatch /
 * applyOperation. All mutation goes through graph_operation_client.
 */

import { z } from 'zod';
import {
  blockDefinitions,
  getBlockDefinition,
} from '../../../core/blockRegistry.js';
import { FLOW_PORTS } from '../../../core/graph/flowPorts.js';
import {
  isGraphKeyboardNode,
  isReplyCapable,
  KEYBOARD_EDGE_SOURCE_PORT,
  KEYBOARD_EDGE_TARGET_PORT,
} from '../../../core/keyboard_topology.js';
import { GraphEdgeSchema } from './contracts.js';

/** Canonical port directions. */
export const PORT_DIRECTIONS = Object.freeze({
  INPUT: 'in',
  OUTPUT: 'out',
});

/**
 * Semantic port kinds. The codegen / VM only cares about transport
 * (FLOW), but the UI uses these to decide if two ports can be wired
 * together puzzle-piece-style without producing nonsense graphs.
 */
export const PORT_KINDS = Object.freeze({
  FLOW: 'flow',
  KEYBOARD: 'keyboard',
  CONDITION_TRUE: 'true',
  CONDITION_FALSE: 'false',
  LOOP_BODY: 'body',
  LOOP_DONE: 'done',
});

/** Compatibility table between source.kind → set of accepted target kinds. */
const PORT_COMPAT = Object.freeze({
  flow: new Set(['flow']),
  keyboard: new Set(['keyboard']),
  true: new Set(['flow']),
  false: new Set(['flow']),
  body: new Set(['flow']),
  done: new Set(['flow']),
});

/** Explicitly forbidden source→target type pairs (type-level only; use ports for conditions). */
const FORBIDDEN_TYPE_PAIRS = new Set([
  'message|command',
  'command|condition',
]);

/** Block category groups used to derive default inspector field sets. */
const CATEGORY_DESCRIPTORS = Object.freeze({
  control: 'control',
  logic: 'logic',
  render: 'render',
  media: 'media',
  action: 'action',
  data: 'data',
  telegram: 'telegram',
  settings: 'settings',
});

/** Inspector field schemas — graph-native, no stack vocabulary. */
const INSPECTOR_FIELDS = Object.freeze({
  version: [{ key: 'version', label: 'Версия', tag: 'input' }],
  bot: [{ key: 'token', label: 'Telegram Bot Token', tag: 'input', secret: true }],
  commands: [{ key: 'commands', label: 'Список команд', tag: 'textarea', rows: 4 }],
  global: [
    { key: 'varname', label: 'Имя переменной', tag: 'input' },
    { key: 'value', label: 'Значение', tag: 'input' },
  ],
  set_global: [
    { key: 'varname', label: 'Имя переменной', tag: 'input' },
    { key: 'value', label: 'Значение', tag: 'input' },
  ],

  start: [],
  command: [{ key: 'cmd', label: 'Команда (без /)', tag: 'input' }],
  callback: [
    { key: 'label', label: 'Текст reply-кнопки', tag: 'input' },
    { key: 'data', label: 'callback_data', tag: 'input' },
  ],
  on_text: [{ key: 'pattern', label: 'Шаблон (опц.)', tag: 'input' }],
  on_photo: [],
  on_voice: [],
  on_document: [],
  on_sticker: [],
  on_location: [],
  on_contact: [],

  message: [{ key: 'text', label: 'Текст', tag: 'textarea', rows: 3 }],
  reply: [{ key: 'text', label: 'Ответ', tag: 'textarea', rows: 3 }],
  caption: [{ key: 'text', label: 'Подпись', tag: 'textarea', rows: 2 }],
  buttons: [{ key: 'rows', label: 'Кнопки', tag: 'textarea', rows: 4 }],
  inline: [{ key: 'buttons', label: 'Inline-кнопки', tag: 'textarea', rows: 4 }],
  inline_keyboard: [
    { key: 'resizeKeyboard', label: 'Подгонять размер', tag: 'checkbox' },
    { key: 'oneTimeKeyboard', label: 'Скрыть после нажатия', tag: 'checkbox' },
  ],
  reply_keyboard: [
    { key: 'resizeKeyboard', label: 'Подгонять размер', tag: 'checkbox' },
    { key: 'oneTimeKeyboard', label: 'Скрыть после нажатия', tag: 'checkbox' },
  ],

  condition: [{ key: 'cond', label: 'Условие', tag: 'input' }],
  condition_not: [{ key: 'cond', label: 'Условие (отрицание)', tag: 'input' }],
  else: [],
  ask: [
    { key: 'question', label: 'Вопрос', tag: 'textarea', rows: 2 },
    { key: 'varname', label: 'Сохранить в переменную', tag: 'input' },
  ],
  remember: [
    { key: 'varname', label: 'Переменная', tag: 'input' },
    { key: 'value', label: 'Значение', tag: 'input' },
  ],
  get: [
    { key: 'key', label: 'Ключ хранилища', tag: 'input' },
    { key: 'varname', label: 'Переменная', tag: 'input' },
  ],
  save: [
    { key: 'key', label: 'Ключ хранилища', tag: 'input' },
    { key: 'value', label: 'Значение', tag: 'input' },
  ],
  loop: [
    { key: 'mode', label: 'Режим (count / while)', tag: 'input' },
    { key: 'count', label: 'Количество (если count)', tag: 'input' },
    { key: 'cond', label: 'Условие (если while)', tag: 'input' },
  ],

  delay: [{ key: 'seconds', label: 'Секунд ожидания', tag: 'input' }],
  pause: [{ key: 'seconds', label: 'Секунд ожидания', tag: 'input' }],
  typing: [{ key: 'seconds', label: 'Секунд "печатает..."', tag: 'input' }],
  log: [
    { key: 'message', label: 'Сообщение', tag: 'input' },
    { key: 'level', label: 'Уровень (info / warn / error)', tag: 'input' },
  ],
  stop: [],
  goto: [{ key: 'target', label: 'Целевой обработчик', tag: 'input' }],

  photo: [
    { key: 'url', label: 'URL или file_id', tag: 'input' },
    { key: 'caption', label: 'Подпись', tag: 'textarea', rows: 2 },
  ],
  photo_var: [
    { key: 'varname', label: 'Переменная', tag: 'input' },
    { key: 'caption', label: 'Подпись', tag: 'textarea', rows: 2 },
  ],
  video: [
    { key: 'url', label: 'URL видео', tag: 'input' },
    { key: 'caption', label: 'Подпись', tag: 'textarea', rows: 2 },
  ],
  audio: [{ key: 'url', label: 'URL аудио', tag: 'input' }],
  document: [
    { key: 'url', label: 'URL файла', tag: 'input' },
    { key: 'filename', label: 'Имя файла', tag: 'input' },
  ],
  document_var: [
    { key: 'varname', label: 'Переменная', tag: 'input' },
    { key: 'filename', label: 'Имя файла', tag: 'input' },
    { key: 'caption', label: 'Подпись', tag: 'textarea', rows: 2 },
  ],
  send_file: [{ key: 'file', label: 'file_id или {переменная}', tag: 'input' }],
  sticker: [{ key: 'file_id', label: 'file_id стикера', tag: 'input' }],
  contact: [
    { key: 'phone', label: 'Телефон', tag: 'input' },
    { key: 'name', label: 'Имя', tag: 'input' },
  ],
  location: [
    { key: 'lat', label: 'Широта', tag: 'input' },
    { key: 'lon', label: 'Долгота', tag: 'input' },
  ],
  poll: [
    { key: 'question', label: 'Вопрос', tag: 'textarea', rows: 2 },
    { key: 'options', label: 'Варианты (по строке)', tag: 'textarea', rows: 4 },
  ],
});

/** Per-type validation rules invoked before dispatch / on Inspector save. */
const VALIDATION_RULES = Object.freeze({
  message: (props) => (String(props?.text ?? '').trim() ? null : 'Текст сообщения не может быть пустым'),
  reply: (props) => (String(props?.text ?? '').trim() ? null : 'Текст ответа не может быть пустым'),
  command: (props) => (String(props?.cmd ?? '').trim() ? null : 'Укажите команду (без /)'),
  callback: (props) => (
    String(props?.data ?? '').trim() || String(props?.label ?? '').trim()
      ? null
      : 'Укажите callback_data или текст кнопки'
  ),
  condition: (props) => (String(props?.cond ?? '').trim() ? null : 'Условие не может быть пустым'),
  condition_not: (props) => (String(props?.cond ?? '').trim() ? null : 'Условие не может быть пустым'),
  ask: (props) => (String(props?.question ?? '').trim() ? null : 'Вопрос не может быть пустым'),
  remember: (props) => (String(props?.varname ?? '').trim() ? null : 'Укажите имя переменной'),
  get: (props) => (String(props?.key ?? '').trim() ? null : 'Укажите ключ хранилища'),
  save: (props) => (String(props?.key ?? '').trim() ? null : 'Укажите ключ хранилища'),
  goto: (props) => (String(props?.target ?? '').trim() ? null : 'Укажите целевой обработчик'),
  loop: (props) => {
    const mode = String(props?.mode ?? 'count').trim();
    if (mode === 'count') {
      const n = Number(props?.count);
      if (!Number.isFinite(n) || n <= 0) return 'Количество итераций должно быть положительным числом';
    } else if (mode === 'while') {
      if (!String(props?.cond ?? '').trim()) return 'Укажите условие цикла';
    }
    return null;
  },
  bot: (props) => (String(props?.token ?? '').trim() ? null : 'Токен бота обязателен'),
  version: (props) => (String(props?.version ?? '').trim() ? null : 'Укажите версию'),
});

function portFromFlow(blockType, dir) {
  const cfg = FLOW_PORTS[blockType] || { input: 'flow', output: 'flow' };
  const transport = dir === PORT_DIRECTIONS.INPUT ? cfg.input : cfg.output;
  return transport ?? null;
}

function buildOutputPorts(definition) {
  const type = definition.type;
  if (isReplyCapable(type)) {
    const flowTransport = portFromFlow(type, PORT_DIRECTIONS.OUTPUT) || 'flow';
    const ports = [
      { id: flowTransport, transport: flowTransport, kind: PORT_KINDS.FLOW, label: 'flow' },
      {
        id: KEYBOARD_EDGE_SOURCE_PORT,
        transport: KEYBOARD_EDGE_SOURCE_PORT,
        kind: PORT_KINDS.KEYBOARD,
        label: 'keyboard',
      },
    ];
    return ports;
  }
  const transport = portFromFlow(type, PORT_DIRECTIONS.OUTPUT);
  if (transport == null) return [];
  if (definition.type === 'condition' || definition.type === 'condition_not') {
    return [
      { id: PORT_KINDS.CONDITION_TRUE, transport, kind: PORT_KINDS.CONDITION_TRUE, label: 'TRUE', edgeLabel: 'TRUE' },
      { id: PORT_KINDS.CONDITION_FALSE, transport, kind: PORT_KINDS.CONDITION_FALSE, label: 'FALSE', edgeLabel: 'FALSE' },
    ];
  }
  if (definition.type === 'loop') {
    return [
      { id: PORT_KINDS.LOOP_BODY, transport, kind: PORT_KINDS.LOOP_BODY, label: 'BODY', edgeLabel: 'body' },
      { id: PORT_KINDS.LOOP_DONE, transport, kind: PORT_KINDS.LOOP_DONE, label: 'DONE', edgeLabel: 'done' },
    ];
  }
  return [{ id: transport, transport, kind: PORT_KINDS.FLOW, label: transport === 'scenario_flow' ? 'scenario' : 'flow' }];
}

function buildInputPorts(definition) {
  if (isGraphKeyboardNode(definition.type)) {
    return [{
      id: KEYBOARD_EDGE_TARGET_PORT,
      transport: KEYBOARD_EDGE_TARGET_PORT,
      kind: PORT_KINDS.KEYBOARD,
      label: 'keyboard',
    }];
  }
  const transport = portFromFlow(definition.type, PORT_DIRECTIONS.INPUT);
  if (transport == null) return [];
  return [{ id: transport, transport, kind: PORT_KINDS.FLOW, label: transport === 'scenario_flow' ? 'scenario' : 'flow' }];
}

function rolesFor(definition) {
  const flow = definition.constraints?.flow || {};
  const ui = definition.constraints?.ui || {};
  return Object.freeze({
    isRoot: Boolean(ui.canBeRoot || flow.canBeRoot),
    isTerminal: definition.type === 'stop' || definition.type === 'goto' || isGraphKeyboardNode(definition.type),
    isSettings: definition.category === CATEGORY_DESCRIPTORS.settings,
  });
}

function buildContract(definition) {
  const inputs = Object.freeze(buildInputPorts(definition).map(Object.freeze));
  const outputs = Object.freeze(buildOutputPorts(definition).map(Object.freeze));
  const flow = definition.constraints?.flow || {};
  const allowedTargetCategories = flow.allowedTargetCategories
    ? Object.freeze([...flow.allowedTargetCategories])
    : null;
  const inspectorSchema = Object.freeze(
    (INSPECTOR_FIELDS[definition.type] || []).map((field) => Object.freeze({ ...field })),
  );
  return Object.freeze({
    type: definition.type,
    category: definition.category,
    description: definition.description,
    inputs,
    outputs,
    allowedConnections: Object.freeze({
      maxOutputs: flow.maxOutputs ?? null,
      outputLabels: flow.outputLabels ? Object.freeze([...flow.outputLabels]) : null,
      allowedTargetCategories,
    }),
    inspectorSchema,
    validationRules: VALIDATION_RULES[definition.type] || null,
    roles: rolesFor(definition),
  });
}

const REGISTRY = Object.freeze(
  Object.fromEntries(
    blockDefinitions.map((definition) => [definition.type, buildContract(definition)]),
  ),
);

const FALLBACK_CONTRACT = Object.freeze({
  type: 'unknown',
  category: 'action',
  description: 'Unknown node type',
  inputs: Object.freeze([Object.freeze({ id: 'flow', transport: 'flow', kind: PORT_KINDS.FLOW, label: 'flow' })]),
  outputs: Object.freeze([Object.freeze({ id: 'flow', transport: 'flow', kind: PORT_KINDS.FLOW, label: 'flow' })]),
  allowedConnections: Object.freeze({ maxOutputs: null, outputLabels: null, allowedTargetCategories: null }),
  inspectorSchema: Object.freeze([]),
  validationRules: null,
  roles: Object.freeze({ isRoot: false, isTerminal: false, isSettings: false }),
});

/** Lookup an operation contract by node type. */
export function getOperationContract(nodeType) {
  return REGISTRY[String(nodeType || '').trim()] || FALLBACK_CONTRACT;
}

/** All known operation contracts (keyed by type). */
export function listOperationContracts() {
  return REGISTRY;
}

function findPort(ports, portId) {
  if (!Array.isArray(ports) || ports.length === 0) return null;
  if (!portId) return ports[0];
  return ports.find((p) => p.id === portId) || ports.find((p) => p.transport === portId) || null;
}

function arePortKindsCompatible(sourceKind, targetKind) {
  if (!sourceKind || !targetKind) return false;
  const allowed = PORT_COMPAT[sourceKind];
  return allowed ? allowed.has(targetKind) : false;
}

function categoryAllowed(sourceContract, targetContract) {
  const allowed = sourceContract.allowedConnections.allowedTargetCategories;
  if (!allowed) return true;
  return allowed.includes(targetContract.category);
}

/**
 * Pure compatibility check between two node types & port ids.
 * Used both by `isValidConnection` (live drag preview) and by
 * the dispatch gate before AddEdge is fired.
 *
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function canConnect(sourceType, targetType, sourcePortId = null, targetPortId = null) {
  const source = getOperationContract(sourceType);
  const target = getOperationContract(targetType);
  if (source === FALLBACK_CONTRACT && !sourceType) {
    return { ok: false, reason: 'Unknown source node type' };
  }
  if (target === FALLBACK_CONTRACT && !targetType) {
    return { ok: false, reason: 'Unknown target node type' };
  }
  if (source.roles.isTerminal) {
    return { ok: false, reason: `${source.type}: terminal node has no outputs` };
  }
  if (target.roles.isSettings) {
    return { ok: false, reason: `${target.type}: settings nodes do not accept incoming flow` };
  }
  if (source.outputs.length === 0) {
    return { ok: false, reason: `${source.type}: no output ports` };
  }
  if (target.inputs.length === 0) {
    return { ok: false, reason: `${target.type}: no input ports` };
  }
  const sourcePort = findPort(source.outputs, sourcePortId);
  const targetPort = findPort(target.inputs, targetPortId);
  if (!sourcePort) return { ok: false, reason: `${source.type}: output port ${sourcePortId} not found` };
  if (!targetPort) return { ok: false, reason: `${target.type}: input port ${targetPortId} not found` };
  const sTrans = sourcePort.transport;
  const tTrans = targetPort.transport;
  if (sTrans !== '*' && tTrans !== '*' && sTrans !== tTrans) {
    return { ok: false, reason: `port transport mismatch (${sTrans} → ${tTrans})` };
  }
  if (!arePortKindsCompatible(sourcePort.kind, targetPort.kind)) {
    return { ok: false, reason: `port kind incompatible (${sourcePort.kind} → ${targetPort.kind})` };
  }
  if (
    (source.type === 'condition' || source.type === 'condition_not')
    && targetPort.kind === PORT_KINDS.FLOW
    && sourcePort.kind !== PORT_KINDS.CONDITION_TRUE
    && sourcePort.kind !== PORT_KINDS.CONDITION_FALSE
  ) {
    return {
      ok: false,
      reason: 'condition requires TRUE or FALSE branch port',
      code: 'CONDITION_BRANCH_REQUIRED',
    };
  }
  // Project-specific forbidden pairs
  if (FORBIDDEN_TYPE_PAIRS.has(`${source.type}|${target.type}`)) {
    return { ok: false, reason: `${source.type} cannot be connected to ${target.type}` };
  }
  if (!categoryAllowed(source, target)) {
    return { ok: false, reason: `${source.type} cannot target category ${target.category}` };
  }
  return { ok: true };
}

/**
 * Validate a connection request against the current GraphDocument.
 * Enforces:
 *  - both endpoints exist
 *  - no self-loop
 *  - operation-contract compatibility (ports, kinds, categories)
 *  - maxOutputs cap on the source
 *  - no duplicate edges (same source/target + same port pair)
 */
export function validateConnection(document, params) {
  const { source, target, sourcePort, targetPort, ignoreEdgeId = null } = params || {};
  if (!source || !target) return { ok: false, reason: 'Edge endpoints required' };
  if (source === target) return { ok: false, reason: 'Self-loops are not allowed' };
  const nodes = document?.nodes || {};
  const sourceNode = nodes[source];
  const targetNode = nodes[target];
  if (!sourceNode) return { ok: false, reason: `Source node ${source} does not exist` };
  if (!targetNode) return { ok: false, reason: `Target node ${target} does not exist` };
  const compat = canConnect(sourceNode.type, targetNode.type, sourcePort, targetPort);
  if (!compat.ok) return compat;
  const existing = Object.values(document?.edges || {});
  const duplicate = existing.find((edge) => (
    edge.id !== ignoreEdgeId
    && edge.source === source
    && edge.target === target
    && (edge.sourcePort || 'flow') === (sourcePort || 'flow')
    && (edge.targetPort || 'flow') === (targetPort || 'flow')
  ));
  if (duplicate) return { ok: false, reason: 'Connection already exists' };
  const sourceContract = getOperationContract(sourceNode.type);
  if (sourceContract.allowedConnections.maxOutputs != null) {
    const sourcePortId = sourcePort || sourceContract.outputs[0]?.id || 'flow';
    const usedFromPort = existing.filter((edge) => (
      edge.id !== ignoreEdgeId
      && edge.source === source
      && (edge.sourcePort || 'flow') === sourcePortId
    )).length;
    const cap = sourceContract.allowedConnections.maxOutputs;
    if (cap > 0 && usedFromPort >= cap) {
      return { ok: false, reason: `${sourceNode.type}: output ${sourcePortId} already has ${cap} edge(s)` };
    }
  }
  return { ok: true };
}

/**
 * Validate node props against the per-type validation rule.
 * Returns null when valid, or a human-readable reason string.
 */
export function validateNodeProps(nodeType, props) {
  const contract = getOperationContract(nodeType);
  if (!contract.validationRules) return null;
  return contract.validationRules(props || {}) || null;
}

/**
 * Validate an entire GraphDocument before any structural action.
 * Returns { ok, errors, warnings }.
 */
export function validateGraph(document) {
  const errors = [];
  const warnings = [];
  const nodes = document?.nodes || {};
  const edges = Object.values(document?.edges || {});

  for (const [id, node] of Object.entries(nodes)) {
    const contract = getOperationContract(node.type);
    if (contract === FALLBACK_CONTRACT) {
      errors.push(`Node ${id}: unknown type "${node.type}"`);
      continue;
    }
    const reason = validateNodeProps(node.type, node.data);
    if (reason) errors.push(`Node ${id} (${node.type}): ${reason}`);
  }

  for (const edge of edges) {
    const parsed = GraphEdgeSchema.safeParse(edge);
    if (!parsed.success) {
      errors.push(`Edge ${edge.id}: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
      continue;
    }
    const v = validateConnection(document, {
      source: edge.source,
      target: edge.target,
      sourcePort: edge.sourcePort,
      targetPort: edge.targetPort,
      ignoreEdgeId: edge.id,
    });
    if (!v.ok) errors.push(`Edge ${edge.id}: ${v.reason}`);
  }

  for (const [id, node] of Object.entries(nodes)) {
    const contract = getOperationContract(node.type);
    if (contract === FALLBACK_CONTRACT) continue;
    if (contract.roles.isSettings || contract.roles.isRoot) continue;
    const incoming = edges.filter((e) => e.target === id);
    if (incoming.length === 0) warnings.push(`Node ${id} (${node.type}): no incoming flow`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Flat list of port descriptors for a given node (used by node renderers). */
export function getNodePortDescriptors(nodeType) {
  const contract = getOperationContract(nodeType);
  return {
    inputs: contract.inputs,
    outputs: contract.outputs,
  };
}

/**
 * Alias for validateGraph — public surface for UI-layer semantic gate.
 * Identical contract: returns { ok, errors, warnings }.
 */
export const validateGraphSemantics = validateGraph;

/** Useful for the inspector — describes what a node type can connect to. */
export function describeAllowedConnections(nodeType) {
  const contract = getOperationContract(nodeType);
  return {
    inputs: contract.inputs.map((p) => ({ id: p.id, kind: p.kind, label: p.label })),
    outputs: contract.outputs.map((p) => ({ id: p.id, kind: p.kind, label: p.label, edgeLabel: p.edgeLabel || null })),
    maxOutputs: contract.allowedConnections.maxOutputs,
    allowedTargetCategories: contract.allowedConnections.allowedTargetCategories,
  };
}
