import { CAPABILITY_ACTIONS } from '../../capabilities/capabilityIds.mjs';
import { ExecutionIRValidationError } from './validateExecutionIR.mjs';

/**
 * Capability dispatch for Execution IR node types only (no fallback).
 * @param {{ type?: string, payload?: object }} node
 */
export function capabilityForFlowNode(node) {
  const type = String(node?.type || '').trim();
  const p = node?.payload || {};
  const planner = String(p._plannerType || '').trim();

  switch (type) {
    case 'message':
      return CAPABILITY_ACTIONS.SEND_MESSAGE;
    case 'input':
      return CAPABILITY_ACTIONS.PROMPT;
    case 'button':
      return CAPABILITY_ACTIONS.INLINE_FROM_LIST;
    case 'condition':
      return CAPABILITY_ACTIONS.BRANCH;
    case 'action':
      if (p.halt || planner === 'terminal') return CAPABILITY_ACTIONS.HALT;
      if (planner === 'remember') return CAPABILITY_ACTIONS.CTX_SET_VAR;
      if (planner === 'persist') return CAPABILITY_ACTIONS.SAVE_STORAGE;
      if (planner === 'load') return CAPABILITY_ACTIONS.LOAD_STORAGE;
      if (planner === 'send_file') return CAPABILITY_ACTIONS.SEND_DOCUMENT;
      if (p.structuralType) return CAPABILITY_ACTIONS.ROUTE;
      return CAPABILITY_ACTIONS.ROUTE;
    default:
      throw new ExecutionIRValidationError(
        `capabilityForFlowNode: unmapped Execution IR type "${type}"`,
        { nodeId: node?.id, type },
      );
  }
}

export function payloadForFlowNode(node) {
  const p = node?.payload || {};
  const type = String(node?.type || '').trim();
  const planner = String(p._plannerType || '').trim();

  if (type === 'message') {
    return {
      text: p.text ?? p.message,
      buttons: p.buttons,
      inlineCatalog: p.inlineCatalog,
    };
  }
  if (type === 'input') {
    return { question: p.prompt ?? p.question, varname: p.field ?? p.varname };
  }
  if (type === 'button') {
    return { ...p };
  }
  if (type === 'condition') {
    return { expression: p.cond ?? p.expression };
  }
  if (type === 'action') {
    if (planner === 'remember') return { name: p.field, value: p.value };
    if (planner === 'persist') return { key: p.key, value: p.value, scope: p.scope };
    if (planner === 'load') return { key: p.key, varname: p.field };
    if (planner === 'send_file') return { file: `{${p.field}}` };
    if (p.structuralType) return { structuralType: p.structuralType };
    return { ...p };
  }

  throw new ExecutionIRValidationError(
    `payloadForFlowNode: unmapped Execution IR type "${type}"`,
    { nodeId: node?.id, type },
  );
}
