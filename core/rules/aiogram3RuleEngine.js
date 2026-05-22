/**
 * Aiogram 3 global block rule engine — validation + optional auto-fix before codegen.
 */

import { flowToStacks } from '../codegen/compileCore.js';
import {
  buildCallbackMap,
  synthesizeMissingCallbackHandlers,
} from '../codegen/ast/callbackResolver.js';
import { stacksToFlow } from '../codegen/stacksFlow.js';
import { CompilationError } from '../ir/CompilationError.js';
import {
  getBlockRole,
  getPipelineStageOrder,
  isHandlerRootType,
  isKnownAiogram3BlockType,
  isSystemRootType,
  ROLE_AFTER_OUTPUT,
  ROLE_API,
  ROLE_CONTROL,
  ROLE_DATA,
  ROLE_ENTRY,
  ROLE_FSM,
  ROLE_KEYBOARD,
  ROLE_MEDIA,
  ROLE_OBSERVABILITY,
  ROLE_OUTPUT,
  ROLE_OUTPUT_BIND_TARGET,
  ROLE_SECURITY,
  ROLE_SYSTEM,
} from './aiogram3BlockRoles.js';

/** @typedef {'error' | 'warning'} RuleSeverity */
/**
 * @typedef {object} RuleIssue
 * @property {string} code
 * @property {RuleSeverity} severity
 * @property {string} message
 * @property {string} [blockType]
 * @property {string} [blockId]
 * @property {string} [stackId]
 * @property {number} [index]
 */

function issue(code, severity, message, meta = {}) {
  return {
    code,
    severity,
    message,
    blockType: meta.blockType,
    blockId: meta.blockId,
    stackId: meta.stackId,
    index: meta.index,
  };
}

function cloneStacks(stacks) {
  return (stacks || []).map((stack) => ({
    ...stack,
    blocks: (stack.blocks || []).map((b) => ({
      ...b,
      props: { ...(b.props || {}) },
      uiAttachments: b.uiAttachments ? { ...b.uiAttachments } : undefined,
    })),
  }));
}

function normalizeInput(input) {
  if (Array.isArray(input)) {
    return { stacks: input, flow: stacksToFlow(input) };
  }
  if (input?.nodes) {
    const stacks = flowToStacks(input);
    return { stacks, flow: input };
  }
  return { stacks: [], flow: { nodes: [], edges: [] } };
}

function stackMeta(stack, index) {
  return {
    stackId: stack?.id || `stack_${index}`,
    blocks: stack?.blocks || [],
    root: stack?.blocks?.[0],
    meta: stack?.meta || {},
  };
}

function blockRef(block, stackId, index) {
  return {
    blockType: block?.type,
    blockId: block?.id,
    stackId,
    index,
  };
}

/**
 * @param {object[]} blocks
 * @param {string} stackId
 * @param {RuleIssue[]} errors
 * @param {RuleIssue[]} warnings
 */
function validateUnknownBlocks(blocks, stackId, errors) {
  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i];
    const t = String(b?.type || '').trim();
    if (!t) {
      errors.push(issue('EMPTY_BLOCK_TYPE', 'error', 'Пустой тип блока', blockRef(b, stackId, i)));
      continue;
    }
    if (!isKnownAiogram3BlockType(t)) {
      errors.push(issue(
        'UNKNOWN_BLOCK_TYPE',
        'error',
        `Неизвестный тип блока «${t}» — нет в aiogram3 registry (без fallback)`,
        blockRef(b, stackId, i),
      ));
    }
  }
}

/**
 * @param {object[]} blocks
 * @param {string} stackId
 * @param {RuleIssue[]} errors
 */
function validatePipelineOrderInStack(blocks, stackId, errors, warnings) {
  if (blocks.length < 2) return;
  const rootRole = getBlockRole(blocks[0]?.type);
  let maxStage = getPipelineStageOrder(blocks[0]?.type);
  for (let i = 1; i < blocks.length; i += 1) {
    const t = blocks[i]?.type;
    const stage = getPipelineStageOrder(t);
    if (rootRole === 'system' && !ROLE_SYSTEM.has(t)) {
      errors.push(issue(
        'PIPELINE_SYSTEM_VIOLATION',
        'error',
        `Блок «${t}» не может быть в системном стеке после ${blocks[0].type}`,
        blockRef(blocks[i], stackId, i),
      ));
    }
    if (isHandlerRootType(blocks[0]?.type) && isHandlerRootType(t)) {
      errors.push(issue(
        'NESTED_ENTRYPOINT',
        'error',
        `Второй entrypoint «${t}» внутри handler-стека недопустим`,
        blockRef(blocks[i], stackId, i),
      ));
    }
    if (stage < maxStage - 1 && !ROLE_KEYBOARD.has(t) && !ROLE_OBSERVABILITY.has(t)) {
      warnings.push(issue(
        'PIPELINE_ORDER',
        'warning',
        `«${t}» раньше в pipeline, чем предыдущие блоки (проверьте порядок: control → fsm → output → media)`,
        blockRef(blocks[i], stackId, i),
      ));
    }
    maxStage = Math.max(maxStage, stage);
  }
}

/**
 * @param {object[]} blocks
 * @param {string} stackId
 * @param {RuleIssue[]} errors
 */
function validateRootPlacement(blocks, stackId, errors, metaExecution = {}) {
  if (!blocks.length) return;
  const root = blocks[0];
  const rt = root?.type;
  const exec = metaExecution || {};
  // FSM at root is allowed when this path originates from an async handler root
  if (ROLE_FSM.has(rt)) {
    if (!exec.asyncContext) {
      errors.push(issue('FSM_AS_ROOT', 'error', 'FSM-блок не может быть корнем графа', blockRef(root, stackId, 0)));
    }
  }
  if (ROLE_CONTROL.has(rt) && rt !== 'else') {
    if (!exec.asyncContext) {
      errors.push(issue('CONTROL_AS_ROOT', 'error', 'Управление потоком не может быть корнем', blockRef(root, stackId, 0)));
    }
  }
  if (ROLE_KEYBOARD.has(rt)) {
    if (!exec.asyncContext) {
      errors.push(issue('KEYBOARD_AS_ROOT', 'error', 'Клавиатура без handler и без ответа', blockRef(root, stackId, 0)));
    }
  }
  if (ROLE_API.has(rt) || ROLE_DATA.has(rt)) {
    if (!exec.asyncContext) {
      errors.push(issue('API_AS_ROOT', 'error', 'API/DB блок только внутри handler', blockRef(root, stackId, 0)));
    }
  }
  if ((ROLE_OUTPUT.has(rt) || ROLE_MEDIA.has(rt)) && !isHandlerRootType(rt) && !exec.asyncContext) {
    errors.push(issue('OUTPUT_AS_ROOT', 'error', 'Ответ/медиа требуют handler (entry) выше', blockRef(root, stackId, 0)));
  }
}

/**
 * @param {object[]} blocks
 * @param {string} stackId
 * @param {RuleIssue[]} errors
 * @param {boolean} autoFix
 * @param {object[]} fixes
 */
function validateKeyboardBinding(blocks, stackId, errors) {
  for (let i = 0; i < blocks.length; i += 1) {
    const t = blocks[i]?.type;
    if (!ROLE_KEYBOARD.has(t)) continue;

    let hasTarget = false;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (ROLE_OUTPUT_BIND_TARGET.has(blocks[j]?.type)) {
        hasTarget = true;
        break;
      }
    }
    if (!hasTarget) {
      for (let j = i + 1; j < blocks.length; j += 1) {
        if (ROLE_OUTPUT_BIND_TARGET.has(blocks[j]?.type)) {
          hasTarget = true;
          break;
        }
      }
    }

    if (!hasTarget) {
      errors.push(issue(
        'KeyboardWithoutOutputNode',
        'error',
        `Клавиатура «${t}» не привязана к блоку ответа (message / photo / video / document / poll / contact / location)`,
        blockRef(blocks[i], stackId, i),
      ));
    }
  }
}

/**
 * @param {object[]} blocks
 * @param {string} stackId
 * @param {RuleIssue[]} errors
 */
function validateFsmScope(blocks, stackId, errors, metaExecution = {}) {
  const inHandler = Boolean(metaExecution?.asyncContext) || isHandlerRootType(blocks[0]?.type) || blocks.some((b) => isHandlerRootType(b?.type));
  for (let i = 0; i < blocks.length; i += 1) {
    if (!ROLE_FSM.has(blocks[i]?.type)) continue;
    if (!inHandler && i === 0) {
      errors.push(issue('FSM_OUTSIDE_HANDLER', 'error', 'FSM только внутри async handler', blockRef(blocks[i], stackId, i)));
    }
    if (i === 0 && !metaExecution?.asyncContext) {
      errors.push(issue('FSM_AS_ROOT', 'error', 'FSM не может быть корневым блоком', blockRef(blocks[i], stackId, i)));
    }
  }
}

/**
 * @param {object[]} blocks
 * @param {string} stackId
 * @param {RuleIssue[]} errors
 */
function validateControlScope(blocks, stackId, errors, metaExecution = {}) {
  for (let i = 0; i < blocks.length; i += 1) {
    if (!ROLE_CONTROL.has(blocks[i]?.type) || blocks[i]?.type === 'else') continue;
    if (i === 0 && !metaExecution?.asyncContext) {
      errors.push(issue('CONTROL_AS_ROOT', 'error', 'condition/loop только внутри handler', blockRef(blocks[i], stackId, i)));
    }
    const hasResolution = blocks.slice(i + 1).some((b) =>
      ROLE_OUTPUT.has(b?.type) || ROLE_MEDIA.has(b?.type) || ROLE_FSM.has(b?.type)
      || b?.type === 'stop' || b?.type === 'goto' || ROLE_CONTROL.has(b?.type));
    if (!hasResolution && i < blocks.length - 1) {
      errors.push(issue(
        'CONDITION_UNRESOLVED',
        'warning',
        `«${blocks[i].type}» должен вести к output, FSM, stop или вложенной ветке`,
        blockRef(blocks[i], stackId, i),
      ));
    }
  }
}

/**
 * @param {object[]} blocks
 * @param {string} stackId
 * @param {RuleIssue[]} errors
 */
function validateMediaContext(blocks, stackId, errors, metaExecution = {}) {
  const handlerCtx = Boolean(metaExecution?.asyncContext) || isHandlerRootType(blocks[0]?.type);
  for (let i = 0; i < blocks.length; i += 1) {
    if (!ROLE_MEDIA.has(blocks[i]?.type)) continue;
    if (i === 0 && !handlerCtx) {
      errors.push(issue('MEDIA_WITHOUT_HANDLER', 'error', 'Медиа-блок требует handler context', blockRef(blocks[i], stackId, i)));
    }
    if (i > 0) {
      const hasPriorOutput = blocks.slice(0, i).some((b) =>
        ROLE_OUTPUT_BIND_TARGET.has(b?.type) || isHandlerRootType(b?.type));
      if (!hasPriorOutput && !metaExecution?.asyncContext) {
        errors.push(issue(
          'MEDIA_WITHOUT_OUTPUT',
          'error',
          'Медиа должно быть в handler после entry или send-блока',
          blockRef(blocks[i], stackId, i),
        ));
      }
    }
  }
}

/**
 * @param {object[]} blocks
 * @param {string} stackId
 * @param {RuleIssue[]} errors
 */
function validateApiDataScope(blocks, stackId, errors) {
  for (let i = 0; i < blocks.length; i += 1) {
    const t = blocks[i]?.type;
    if (!ROLE_API.has(t) && !ROLE_DATA.has(t)) continue;
    if (i === 0 || !isHandlerRootType(blocks[0]?.type)) {
      errors.push(issue('API_OUTSIDE_HANDLER', 'error', `«${t}» только внутри handler`, blockRef(blocks[i], stackId, i)));
    }
    if (ROLE_KEYBOARD.has(blocks[i + 1]?.type) || ROLE_OUTPUT.has(blocks[i + 1]?.type)) {
      errors.push(issue(
        'API_BEFORE_UI',
        'error',
        'API/DB не может напрямую предшествовать UI-ответу без логики',
        blockRef(blocks[i], stackId, i),
      ));
    }
  }
}

/**
 * @param {object[]} blocks
 * @param {string} stackId
 * @param {RuleIssue[]} warnings
 */
function validateSecurityOrder(blocks, stackId, warnings) {
  let firstSecurity = -1;
  let firstControl = -1;
  for (let i = 1; i < blocks.length; i += 1) {
    if (firstSecurity < 0 && ROLE_SECURITY.has(blocks[i]?.type)) firstSecurity = i;
    if (firstControl < 0 && ROLE_CONTROL.has(blocks[i]?.type)) firstControl = i;
  }
  if (firstSecurity >= 0 && firstControl >= 0 && firstSecurity > firstControl) {
    warnings.push(issue(
      'SECURITY_AFTER_LOGIC',
      'warning',
      'Проверка прав/подписки должна выполняться до condition/loop',
      blockRef(blocks[firstSecurity], stackId, firstSecurity),
    ));
  }
}

/**
 * Entry root nodes must not link to another entry root (start→command forbidden).
 * Flow edges inside one handler body (start→message) are allowed.
 * @param {object} flow
 * @param {RuleIssue[]} errors
 */
function validateCrossHandlerEdges(flow, errors) {
  const edges = flow?.edges || [];
  const nodes = flow?.nodes || [];
  if (!edges.length || !nodes.length) return;

  const entryRoots = new Map();
  for (const n of nodes) {
    const t = n?.data?.type || n?.type;
    if (isHandlerRootType(t) || t === 'else') {
      entryRoots.set(n.id, t);
    }
  }

  for (const e of edges) {
    const st = entryRoots.get(e.source);
    const tt = entryRoots.get(e.target);
    if (st && tt && e.source !== e.target) {
      errors.push(issue(
        'CROSS_HANDLER_EDGE',
        'error',
        `Связь entry→entry (${st} → ${tt}) запрещена — используйте тело handler`,
        { blockId: e.id },
      ));
    }
  }
}

/**
 * @param {object[]} stacks
 * @param {RuleIssue[]} errors
 * @param {RuleIssue[]} warnings
 */
function validateGraphStructure(stacks, errors, warnings) {
  const handlerStacks = stacks.filter((s) => s?.blocks?.length && isHandlerRootType(s.blocks[0]?.type));
  const entryCount = handlerStacks.length;
  if (!stacks.some((s) => (s?.blocks || []).length > 0)) {
    warnings.push(issue('EMPTY_GRAPH', 'warning', 'Холст пуст'));
    return;
  }
  if (entryCount === 0) {
    errors.push(issue('NO_ENTRYPOINT', 'error', 'Нужен хотя бы один handler (start/command/callback/…)'));
  }
  const hasOutput = stacks.some((s) =>
    (s?.blocks || []).some((b) => ROLE_OUTPUT.has(b?.type) || ROLE_MEDIA.has(b?.type)));
  if (entryCount > 0 && !hasOutput) {
    warnings.push(issue('NO_OUTPUT', 'warning', 'Нет блока ответа (message/медиа) — пользователь не увидит reply'));
  }
  // Несколько entrypoint-цепочек (start, callback, command, on_text) — нормальная схема Telegram-бота.
}

/**
 * @param {unknown} input stacks[] or flow { nodes, edges }
 * @param {{ autoFix?: boolean, mode?: 'strict' | 'soft' }} [options]
 */
export function validateAiogram3Graph(input, options = {}) {
  const autoFix = Boolean(options.autoFix);
  const { stacks: rawStacks, flow } = normalizeInput(input);
  let stacks = cloneStacks(rawStacks);
  const errors = [];
  const warnings = [];
  const fixes = [];

  validateGraphStructure(stacks, errors, warnings);

  for (let si = 0; si < stacks.length; si += 1) {
    const { stackId, blocks, meta } = stackMeta(stacks[si], si);
    if (!blocks.length) continue;

    validateUnknownBlocks(blocks, stackId, errors);
    const metaExecution = meta?.executionContext || {};
    validateRootPlacement(blocks, stackId, errors, metaExecution);
    validatePipelineOrderInStack(blocks, stackId, errors, warnings);
    validateFsmScope(blocks, stackId, errors, metaExecution);
    validateControlScope(blocks, stackId, errors, metaExecution);
    validateMediaContext(blocks, stackId, errors, metaExecution);
    validateApiDataScope(blocks, stackId, errors);
    validateSecurityOrder(blocks, stackId, warnings);
    validateKeyboardBinding(blocks, stackId, errors);
  }

  validateCrossHandlerEdges(flow, errors);

  if (autoFix) {
    const synth = synthesizeMissingCallbackHandlers(stacks, flow);
    if (synth.fixes.length) {
      stacks = synth.stacks;
      for (const f of synth.fixes) {
        if (f.kind === 'callback_handler') {
          fixes.push(f);
          warnings.push(issue(
            'CALLBACK_HANDLER_AUTO',
            'warning',
            `Добавлен блок «При нажатии» для callback_data «${f.callbackData}» (авто)`,
            { stackId: f.stackId, blockType: 'callback' },
          ));
        } else if (f.kind === 'callback_handler_body') {
          fixes.push(f);
          warnings.push(issue(
            'CALLBACK_HANDLER_BODY_AUTO',
            'warning',
            'К блоку «При нажатии» добавлен ответ «Сообщение» (авто)',
            { blockId: f.blockId, stackId: f.stackId, blockType: 'callback' },
          ));
        }
      }
    }
  }

  const callbackResolution = buildCallbackMap(stacks, flow);
  const deferCallbacks = options.validationStage === 'edit' || options.validationStage === 'insertion';
  for (const e of callbackResolution.errors) {
    errors.push(issue(
      e.code || 'MissingCallbackHandlerError',
      deferCallbacks ? 'warning' : 'error',
      e.message,
      { blockId: e.blockId, blockType: 'inline' },
    ));
  }

  let errList = deferCallbacks
    ? errors.filter((e) => e.severity === 'error' && e.code !== 'MissingCallbackHandlerError')
    : errors.filter((e) => e.severity === 'error');
  let warnList = [...warnings, ...errors.filter((e) => e.severity === 'warning')];

  let outFlow = flow;
  if (fixes.length) {
    outFlow = stacksToFlow(stacks);
    const rerun = validateAiogram3Graph(
      { nodes: outFlow.nodes, edges: outFlow.edges },
      { autoFix: false, validationStage: options.validationStage },
    );
    errList = rerun.errors;
    warnList = [...warnList, ...rerun.warnings];
  }

  return {
    ok: errList.length === 0,
    errors: errList,
    warnings: warnList,
    stacks,
    flow: outFlow,
    fixes,
    stacksModified: fixes.length > 0,
  };
}

/**
 * Strict gate — throws CompilationError-compatible shape.
 * @param {unknown} input
 * @param {{ autoFix?: boolean }} [options]
 */
export function assertAiogram3GraphRules(input, options = {}) {
  const result = validateAiogram3Graph(input, options);
  if (!result.ok) {
    throw new CompilationError(
      result.errors.map((e) => e.message),
      result.warnings.map((w) => w.message),
    );
  }
  return result;
}

/** @param {RuleIssue[]} issues */
export function issuesToCompileErrors(issues) {
  return issues.map((e) => ({
    code: e.code,
    message: e.message,
    blockType: e.blockType,
    nodeId: e.blockId,
    severity: e.severity,
  }));
}
