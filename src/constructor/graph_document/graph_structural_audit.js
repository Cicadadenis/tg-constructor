/**
 * Deep structural audit — connections, compatibility, callbacks, topology.
 * Complements validate_graph.js (schema/FSM) and operation_registry (pre-connect gates).
 */

import { FLOW_PORTS } from '../../../core/graph/flowPorts.js';
import { isGraphKeyboardNode, isAnyKeyboardNode } from '../../../core/keyboard_topology.js';
import { buildCallbackMap } from '../../../core/codegen/ast/callbackResolver.js';
import { applyUiAttachmentsBinding } from '../../../core/codegen/ast/bindKeyboards.js';
import { projectGraphToFlow } from '../../../core/graph/model.js';
import {
  canConnect,
  validateConnection,
  getOperationContract,
  validateNodeProps,
  PORT_KINDS,
} from './operation_registry.js';
import { createGraphDocument } from './graph_document.js';
import { graphDocumentToProjectGraph } from './graph_project_bridge.js';
import { graphDocumentToStacks } from './stacks_bridge.js';
import {
  validateReplyChain,
  collectKeyboardButtonDiagnostics,
} from './graph_keyboard_nodes.js';

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

/**
 * Edges that reference missing nodes in a raw seed (before createGraphDocument drops them).
 */
export function auditPreHydrationEdges(seed) {
  const issues = [];
  const nodeIds = new Set(
    asArray(seed?.nodes).map((n) => String(n?.id || '').trim()).filter(Boolean),
  );
  for (const raw of asArray(seed?.edges)) {
    const edgeId = String(raw?.id || '').trim();
    const source = String(raw?.source ?? raw?.from ?? '').trim();
    const target = String(raw?.target ?? raw?.to ?? '').trim();
    if (!source || !target) {
      issues.push({
        code: 'invalid_edges',
        severity: 'error',
        edgeId: edgeId || null,
        message: `Edge ${edgeId || '(unknown)'} is missing source or target`,
      });
      continue;
    }
    if (nodeIds.size && (!nodeIds.has(source) || !nodeIds.has(target))) {
      issues.push({
        code: 'dangling_edge',
        severity: 'error',
        edgeId: edgeId || null,
        message: `Edge ${edgeId || '(unknown)'} references missing node (source=${source}, target=${target})`,
      });
    }
  }
  return issues;
}

const ROOT_ENTRY_TYPES = new Set([
  'start', 'command', 'callback', 'else',
  'on_text', 'on_photo', 'on_voice', 'on_document', 'on_sticker', 'on_location', 'on_contact',
]);
const SETTINGS_TYPES = new Set(['bot', 'version', 'commands', 'global']);
const TERMINAL_TYPES = new Set(['goto', 'stop']);
const BRANCHING_TYPES = new Set(['condition', 'condition_not', 'loop']);

function buildAdjacency(document) {
  const nodes = document?.nodes || {};
  const edges = Object.values(document?.edges || {});
  const nodeIds = new Set(Object.keys(nodes));
  const outgoing = new Map();
  const incoming = new Map();
  const edgesById = new Map();
  for (const id of nodeIds) {
    outgoing.set(id, []);
    incoming.set(id, []);
  }
  for (const edge of edges) {
    edgesById.set(edge.id, edge);
    if (edge.invalid) continue;
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    outgoing.get(edge.source).push(edge);
    incoming.get(edge.target).push(edge);
  }
  return { nodes, edges, nodeIds, outgoing, incoming, edgesById };
}

function detectCycles(nodeIds, outgoing) {
  const temp = new Set();
  const perm = new Set();
  const cycles = [];
  const trail = [];
  const walk = (id) => {
    if (perm.has(id)) return;
    if (temp.has(id)) {
      const start = trail.indexOf(id);
      cycles.push(trail.slice(start).concat(id));
      return;
    }
    temp.add(id);
    trail.push(id);
    for (const edge of outgoing.get(id) || []) walk(edge.target);
    trail.pop();
    temp.delete(id);
    perm.add(id);
  };
  for (const id of nodeIds) walk(id);
  return cycles;
}

function collectDuplicateEdgeKeys(edges) {
  const seen = new Map();
  const duplicates = [];
  for (const edge of edges) {
    const key = `${edge.source}|${edge.target}|${edge.sourcePort || 'flow'}|${edge.targetPort || 'flow'}`;
    if (seen.has(key)) duplicates.push({ edgeId: edge.id, duplicateOf: seen.get(key) });
    else seen.set(key, edge.id);
  }
  return duplicates;
}

/**
 * Nodes with no incoming flow (except roots/settings) or fully disconnected.
 * @returns {Array<{ code: string, severity: string, nodeId: string, message: string }>}
 */
export function detectOrphanNodes(document, options = {}) {
  const strict = Boolean(options.strict);
  const issues = [];
  const { nodes, nodeIds, incoming, outgoing } = buildAdjacency(document);
  for (const [id, node] of Object.entries(nodes)) {
    const type = String(node.type || '').trim();
    const inN = (incoming.get(id) || []).length;
    const outN = (outgoing.get(id) || []).length;
    if (nodeIds.size <= 1) continue;
    const isRoot = ROOT_ENTRY_TYPES.has(type) || SETTINGS_TYPES.has(type);
    const hasEntryRoot = Object.values(nodes).some((n) => ROOT_ENTRY_TYPES.has(String(n.type || '').trim()));
    if (inN === 0 && outN === 0 && !isRoot) {
      const severity = hasEntryRoot ? 'warning' : 'error';
      const code = hasEntryRoot ? 'dangling_entry' : 'orphan_node';
      issues.push({
        code,
        severity,
        nodeId: id,
        message: hasEntryRoot
          ? `Node ${id} (${type}) is not connected to the flow`
          : `Node ${id} (${type}) is fully disconnected`,
      });
    } else if (inN === 0 && !isRoot && !TERMINAL_TYPES.has(type)) {
      issues.push({
        code: 'dangling_entry',
        severity: strict ? 'error' : 'warning',
        nodeId: id,
        message: `Node ${id} (${type}) has no incoming flow edge`,
      });
    }
  }
  return issues;
}

/**
 * Nodes not reachable from entry roots via flow edges.
 */
export function detectUnreachableChains(document) {
  const issues = [];
  const { nodes, nodeIds, outgoing, incoming } = buildAdjacency(document);
  let roots = Object.entries(nodes)
    .filter(([, n]) => {
      const type = String(n.type || '').trim();
      return ROOT_ENTRY_TYPES.has(type) || SETTINGS_TYPES.has(type);
    })
    .map(([id]) => id);
  if (roots.length === 0) {
    roots = Object.entries(nodes)
      .filter(([id]) => (incoming.get(id) || []).length === 0)
      .map(([id]) => id);
  }

  const reachable = new Set();
  const queue = [...roots];
  while (queue.length) {
    const id = queue.shift();
    if (!id || reachable.has(id)) continue;
    reachable.add(id);
    for (const edge of outgoing.get(id) || []) queue.push(edge.target);
  }

  for (const id of nodeIds) {
    const type = String(nodes[id]?.type || '').trim();
    if (SETTINGS_TYPES.has(type)) continue;
    if (!reachable.has(id)) {
      issues.push({
        code: 'unreachable_node',
        severity: 'warning',
        nodeId: id,
        message: `Node ${id} (${type}) is not reachable from any entry root`,
      });
    }
  }
  return issues;
}

/**
 * Edge integrity: dangling endpoints, self-loops, duplicates, port compatibility.
 */
export function validateGraphConnections(document) {
  const issues = [];
  const { nodes, edges, nodeIds } = buildAdjacency(document);

  for (const edge of edges) {
    const edgeId = String(edge.id || '').trim();
    const source = String(edge.source || '').trim();
    const target = String(edge.target || '').trim();
    if (edge.invalid) {
      issues.push({
        code: 'dangling_edge',
        severity: 'error',
        edgeId,
        message: `Edge ${edgeId} is invalid (${edge.invalidReason || 'dangling'}): ${source} → ${target}`,
      });
      continue;
    }
    if (!source || !target) {
      issues.push({
        code: 'invalid_edges',
        severity: 'error',
        edgeId,
        message: `Edge ${edgeId || '(unknown)'} is missing source or target`,
      });
      continue;
    }
    if (!nodeIds.has(source) || !nodeIds.has(target)) {
      issues.push({
        code: 'dangling_edge',
        severity: 'error',
        edgeId,
        message: `Edge ${edgeId} references deleted or missing node (source=${source}, target=${target})`,
      });
      continue;
    }
    if (source === target) {
      issues.push({
        code: 'self_connection',
        severity: 'error',
        edgeId,
        message: `Edge ${edgeId} is a self-loop on node ${source}`,
      });
    }
    const compat = validateConnection(document, {
      source,
      target,
      sourcePort: edge.sourcePort,
      targetPort: edge.targetPort,
      ignoreEdgeId: edgeId,
    });
    if (!compat.ok) {
      issues.push({
        code: compat.code || 'incompatible_connection',
        severity: 'error',
        edgeId,
        message: compat.reason || 'Incompatible connection',
      });
    }
  }

  for (const dup of collectDuplicateEdgeKeys(edges)) {
    issues.push({
      code: 'duplicate_edge',
      severity: 'error',
      edgeId: dup.edgeId,
      message: `Edge ${dup.edgeId} duplicates connection of edge ${dup.duplicateOf}`,
    });
  }

  const cycles = detectCycles(nodeIds, buildAdjacency(document).outgoing);
  for (const cycle of cycles) {
    issues.push({
      code: 'cyclic_loop',
      severity: 'warning',
      message: `Cycle detected: ${cycle.join(' → ')}`,
    });
  }

  return issues;
}

/**
 * Node type / port topology vs FLOW_PORTS and operation contracts.
 */
export function validateNodeCompatibility(document) {
  const issues = [];
  const { nodes, outgoing, incoming } = buildAdjacency(document);

  for (const [id, node] of Object.entries(nodes)) {
    const type = String(node.type || '').trim();
    const contract = getOperationContract(type);
    const flowPort = FLOW_PORTS[type];

    if (contract.type === 'unknown') {
      issues.push({
        code: 'unknown_node_type',
        severity: 'error',
        nodeId: id,
        message: `Node ${id} has unknown type "${type}"`,
      });
    }

    const propReason = validateNodeProps(type, node.data);
    if (propReason) {
      issues.push({
        code: 'invalid_node_props',
        severity: 'error',
        nodeId: id,
        message: `Node ${id} (${type}): ${propReason}`,
      });
    }

    if (flowPort?.input == null && (incoming.get(id) || []).length > 0 && !SETTINGS_TYPES.has(type)) {
      issues.push({
        code: 'invalid_target_type',
        severity: 'error',
        nodeId: id,
        message: `Node ${id} (${type}) cannot accept incoming flow (entry/settings-only input)`,
      });
    }

    if (flowPort?.output == null && (outgoing.get(id) || []).length > 0) {
      issues.push({
        code: 'invalid_source_type',
        severity: 'error',
        nodeId: id,
        message: `Node ${id} (${type}) cannot emit outgoing flow (terminal node)`,
      });
    }

    if (BRANCHING_TYPES.has(type)) {
      const outEdges = outgoing.get(id) || [];
      if (type === 'condition' || type === 'condition_not') {
        const hasTrue = outEdges.some((e) => (e.sourcePort || 'flow') === PORT_KINDS.CONDITION_TRUE || e.label === 'TRUE');
        const hasFalse = outEdges.some((e) => (e.sourcePort || 'flow') === PORT_KINDS.CONDITION_FALSE || e.label === 'FALSE');
        if (!hasTrue) {
          issues.push({
            code: 'dead_end_branch',
            severity: 'warning',
            nodeId: id,
            message: `Node ${id} (${type}) has no TRUE branch successor`,
          });
        }
        if (!hasFalse) {
          issues.push({
            code: 'dead_end_branch',
            severity: 'warning',
            nodeId: id,
            message: `Node ${id} (${type}) has no FALSE branch successor`,
          });
        }
      }
      if (type === 'loop') {
        const hasBody = outEdges.some((e) => (e.sourcePort || 'flow') === PORT_KINDS.LOOP_BODY);
        const hasDone = outEdges.some((e) => (e.sourcePort || 'flow') === PORT_KINDS.LOOP_DONE);
        if (!hasBody) {
          issues.push({
            code: 'dead_end_branch',
            severity: 'warning',
            nodeId: id,
            message: `Node ${id} (loop) has no BODY branch successor`,
          });
        }
        if (!hasDone) {
          issues.push({
            code: 'dead_end_branch',
            severity: 'warning',
            nodeId: id,
            message: `Node ${id} (loop) has no DONE branch successor`,
          });
        }
      }
    } else if (!TERMINAL_TYPES.has(type) && !SETTINGS_TYPES.has(type) && !ROOT_ENTRY_TYPES.has(type)) {
      const outN = (outgoing.get(id) || []).length;
      const inN = (incoming.get(id) || []).length;
      if (inN > 0 && outN === 0 && !isAnyKeyboardNode(type)) {
        issues.push({
          code: 'dead_end_chain',
          severity: 'warning',
          nodeId: id,
          message: `Node ${id} (${type}) is a dead-end (incoming flow but no successor)`,
        });
      }
    }

    if (type === 'ask') {
      const outN = (outgoing.get(id) || []).length;
      if (outN === 0) {
        issues.push({
          code: 'missing_successor',
          severity: 'warning',
          nodeId: id,
          message: `Node ${id} (ask) should connect to a handler for the user answer`,
        });
      }
    }
  }

  return issues;
}

/**
 * Required callback handlers for inline keyboard routes (codegen-level).
 * @param {object} document
 * @param {{ allowMissingCallbackHandlers?: boolean }} [options]
 */
export function validateRequiredHandlers(document, options = {}) {
  const soft = Boolean(options.allowMissingCallbackHandlers);
  const callbackSeverity = soft ? 'warning' : 'error';
  const issues = [];
  try {
    let stacks = graphDocumentToStacks(document);
    const bound = applyUiAttachmentsBinding(stacks);
    stacks = bound.stacks;
    const flow = projectGraphToFlow(graphDocumentToProjectGraph(document));
    const result = buildCallbackMap(stacks, flow);
    if (!result.ok) {
      for (const err of result.errors || []) {
        const code = err.code === 'MissingCallbackHandlerError'
          ? 'missing_handlers'
          : (err.code === 'CALLBACK_HANDLER_DISCONNECTED' ? 'broken_callback_route' : 'invalid_callbacks');
        const buttonLabel = err.buttonLabel || err.callbackLabel;
        const humanMsg = buttonLabel
          ? `У кнопки «${buttonLabel}» нет действия при нажатии`
          : (err.message || 'Callback handler validation failed');
        issues.push({
          code,
          severity: callbackSeverity,
          nodeId: err.blockId || null,
          message: humanMsg,
          callbackData: err.callbackData || null,
          buttonLabel,
        });
      }
    }
  } catch (e) {
    issues.push({
      code: 'callback_validation_failed',
      severity: soft ? 'warning' : 'error',
      message: `Callback map build failed: ${e?.message || String(e)}`,
    });
  }
  return issues;
}

/**
 * Inline keyboards with callback_data but no matching callback entry in graph/stacks.
 */
export function detectBrokenCallbacks(document) {
  return validateRequiredHandlers(document).filter((x) => (
    x.code === 'missing_handlers'
    || x.code === 'broken_callback_route'
    || x.code === 'invalid_callbacks'
  ));
}

/**
 * Full structural audit — aggregates all checks with severity summary.
 * @param {object} document — GraphDocument
 * @param {{ strict?: boolean, includeCallbacks?: boolean }} [options]
 */
export function runGraphStructuralAudit(graphOrSeed, options = {}) {
  const includeCallbacks = options.includeCallbacks !== false;
  const allowMissingCallbackHandlers = Boolean(options.allowMissingCallbackHandlers);
  const isRawSeed = Array.isArray(graphOrSeed?.nodes) || Array.isArray(graphOrSeed?.edges);
  const preIssues = isRawSeed ? auditPreHydrationEdges(graphOrSeed) : [];
  const document = isRawSeed || !graphOrSeed?.nodes || typeof graphOrSeed.nodes !== 'object'
    ? createGraphDocument(graphOrSeed || {})
    : graphOrSeed;

  const buckets = [
    ...preIssues,
    validateGraphConnections(document),
    validateNodeCompatibility(document),
    validateReplyChain(document, { strict: options.strict }),
    detectOrphanNodes(document, { strict: options.strict }),
    detectUnreachableChains(document),
  ];
  if (includeCallbacks) {
    buckets.push(validateRequiredHandlers(document, { allowMissingCallbackHandlers }));
    buckets.push(collectKeyboardButtonDiagnostics(document, {
      allowMissingHandlers: allowMissingCallbackHandlers,
    }));
  }

  const issues = buckets.flat();
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  const byCode = {};
  for (const item of issues) {
    byCode[item.code] = (byCode[item.code] || 0) + 1;
  }

  return {
    ok: errors.length === 0,
    issues,
    errors,
    warnings,
    summary: {
      total: issues.length,
      errors: errors.length,
      warnings: warnings.length,
      byCode,
    },
  };
}

/**
 * Pre-flight check for a single connection (UI drag or programmatic AddEdge).
 */
export function validateConnectionRequest(document, params) {
  const { source, target, sourcePort, targetPort } = params || {};
  const nodes = document?.nodes || {};
  const sourceNode = nodes[source];
  const targetNode = nodes[target];
  if (!sourceNode || !targetNode) {
    return { ok: false, reason: 'Unknown endpoint node' };
  }
  const drag = canConnect(sourceNode.type, targetNode.type, sourcePort, targetPort);
  if (!drag.ok) return drag;
  return validateConnection(document, params);
}
