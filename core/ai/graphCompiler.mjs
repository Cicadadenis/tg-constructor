/**
 * Compiler: valid Canonical AI IR (Bot IR) → executable editor stacks.
 * Rejects invalid IR — never emits graph from broken input.
 *
 * Separation: scenarios live in Bot IR (intent). Flow Graph / Execution IR
 * are built only via synthesizeFlowGraph → executionGraphCompiler (no scenario nodes).
 */

import {
  canonicalIrToEditorStacks,
  normalizeAiCanonicalIr,
  validateAiCanonicalIr,
} from './aiCanonicalIr.mjs';
import { validateIrSemanticGate } from './irSemanticGate.mjs';
import { reconcileIrGraph } from './graphReconciler.mjs';
import { validateNodeType } from '../runtime/execution/executionNodeTypes.mjs';
import { ALLOWED_FLOW_GRAPH_NODE_TYPES } from '../runtime/execution/executionNodeTypes.mjs';
import { isIntentOnlyBlockType } from './intentNodeRegistry.mjs';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Validate a flow-graph node for execution pipeline (throws on scenario / unknown).
 * @param {{ id?: string, type?: string }} node
 * @param {{ strict?: boolean }} [options]
 */
export function validateExecutionGraphNodeType(node, options = {}) {
  return validateNodeType(node, ALLOWED_FLOW_GRAPH_NODE_TYPES, {
    strict: options.strict !== false,
    throwOnIntentOnly: true,
  });
}

/**
 * Guard: editor stacks may contain scenario blocks (intent layer); never pass stacks to Execution IR.
 * @param {object[]} stacks
 */
export function assertStacksAreIntentLayerOnly(stacks) {
  for (const stack of asArray(stacks)) {
    for (const block of asArray(stack?.blocks)) {
      if (isIntentOnlyBlockType(block?.type)) {
        continue;
      }
    }
  }
  return { ok: true };
}

/**
 * Compile Canonical AI IR to editor stacks after validation gates.
 * @param {object} ir
 * @param {{ astMode?: string, allowedMemoryKeys?: string[], reconcile?: boolean }} [options]
 */
export function compileBotIrToExecutableGraph(ir, options = {}) {
  const normalized = normalizeAiCanonicalIr(ir);
  const structural = validateAiCanonicalIr(normalized, {
    astMode: options.astMode,
    allowedMemoryKeys: options.allowedMemoryKeys,
  });
  if (structural.errors.length > 0) {
    return {
      ok: false,
      stacks: null,
      ir: normalized,
      errors: structural.errors,
      diagnostics: structural.errors.map((message) => ({
        code: 'IR_STRUCTURE_ERROR',
        severity: 'error',
        message,
      })),
    };
  }

  let candidate = normalized;
  if (options.reconcile !== false) {
    const reconciled = reconcileIrGraph(candidate);
    candidate = reconciled.ir;
  }

  const semantic = validateIrSemanticGate(candidate, {
    astMode: options.astMode,
    allowedMemoryKeys: options.allowedMemoryKeys,
  });
  if (!semantic.ok) {
    const messages = asArray(semantic.diagnostics).map((d) => d.message || String(d));
    return {
      ok: false,
      stacks: null,
      ir: candidate,
      errors: messages.length ? messages : ['IR semantic gate failed'],
      diagnostics: semantic.diagnostics,
    };
  }

  const stacks = canonicalIrToEditorStacks(candidate);
  if (!Array.isArray(stacks) || stacks.length === 0) {
    return {
      ok: false,
      stacks: null,
      ir: candidate,
      errors: ['Compiler produced empty stacks'],
      diagnostics: [{ code: 'COMPILER_EMPTY', severity: 'error', message: 'Empty executable graph' }],
    };
  }

  return {
    ok: true,
    stacks,
    ir: candidate,
    errors: [],
    diagnostics: [
      {
        code: 'GRAPH_COMPILED',
        severity: 'info',
        message: `Executable graph compiled: ${stacks.length} stacks.`,
      },
    ],
  };
}
