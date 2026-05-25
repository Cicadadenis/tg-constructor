/**
 * Single strict compiler gate before Execution IR generation.
 * Replaces scattered partial validators (validateExecutionIR, contract-only pass, post-plan check).
 */

import { getNodeManifestRegistry } from '../node_manifest/nodeManifestRegistry.mjs';
import {
  assertValidExecutionContract,
} from '../node_manifest/executionContract.mjs';
import {
  isNonExecutableFlowNode,
  resolveManifestBlockTypeForFlowNode,
} from '../node_manifest/resolveManifestForFlowNode.mjs';
import {
  ALLOWED_EXECUTION_IR_NODE_TYPES,
  normalizeFlowGraphForExecutionIR,
} from '../runtime/execution/validateExecutionIR.mjs';
import { isIntentOnlyNodeType } from '../runtime/execution/executionNodeTypes.mjs';
import { canConnect } from '../../src/constructor/graph_document/operation_registry.js';

export class StrictExecutionCompilerError extends Error {
  /**
   * @param {string[]} issues
   */
  constructor(issues) {
    const list = issues.filter(Boolean);
    super(
      list.length
        ? `Execution compiler validation failed:\n${list.map((i) => `  • ${i}`).join('\n')}`
        : 'Execution compiler validation failed',
    );
    this.name = 'StrictExecutionCompilerError';
    this.issues = Object.freeze(list);
  }
}

/**
 * @param {string[]} errors
 * @param {string} issue
 */
function pushError(errors, issue) {
  if (issue) errors.push(String(issue));
}

/**
 * @param {object} edge
 * @param {object} sourceNode — normalized flow node
 */
function resolveFlowEdgePorts(edge, sourceNode) {
  const kind = String(edge?.kind || 'flow').trim().toLowerCase();
  if (sourceNode?.type === 'condition') {
    if (kind === 'true') {
      return { sourcePort: 'true', targetPort: 'flow' };
    }
    if (kind === 'false') {
      return { sourcePort: 'false', targetPort: 'flow' };
    }
  }
  return { sourcePort: 'flow', targetPort: 'flow' };
}

/**
 * @param {object} flowGraph — raw capability flow graph
 * @returns {object} normalized flow graph (only when validation passes)
 */
export function runStrictExecutionCompilerGate(flowGraph) {
  const errors = [];

  let normalized;
  try {
    normalized = normalizeFlowGraphForExecutionIR(flowGraph);
  } catch (err) {
    pushError(errors, err instanceof Error ? err.message : String(err));
    throw new StrictExecutionCompilerError(errors);
  }

  const nodes = normalized.nodes || [];
  const edges = Array.isArray(normalized.edges) ? normalized.edges : [];
  const nodeById = new Map(nodes.map((n) => [String(n.id), n]));
  const registry = getNodeManifestRegistry();

  for (const node of nodes) {
    const nodeId = String(node?.id ?? '').trim();
    if (!nodeId) {
      pushError(errors, 'Flow graph node is missing id');
      continue;
    }

    const plannerType = String(node?.payload?._plannerType ?? node?.type ?? '').trim();
    if (!plannerType) {
      pushError(errors, `Node ${nodeId}: missing planner type`);
      continue;
    }

    if (isIntentOnlyNodeType(plannerType)) {
      pushError(
        errors,
        `Node ${nodeId}: intent-only type "${plannerType}" cannot reach Execution IR`,
      );
      continue;
    }

    const executionType = String(node?.type ?? '').trim();
    if (!ALLOWED_EXECUTION_IR_NODE_TYPES.has(executionType)) {
      pushError(
        errors,
        `Node ${nodeId}: execution type "${executionType || '∅'}" is not allowed `
        + `(allowed: ${[...ALLOWED_EXECUTION_IR_NODE_TYPES].join(', ')})`,
      );
      continue;
    }

    if (isNonExecutableFlowNode(node)) {
      continue;
    }

    const manifestType = resolveManifestBlockTypeForFlowNode(node);
    if (!manifestType) {
      pushError(
        errors,
        `Node ${nodeId}: cannot resolve NodeManifest block type (execution type "${executionType}")`,
      );
      continue;
    }

    if (!registry.has(manifestType)) {
      pushError(
        errors,
        `Node ${nodeId}: unknown type "${manifestType}" — not in NodeManifestRegistry`,
      );
      continue;
    }

    const manifest = registry.get(manifestType, { nodeId });

    try {
      assertValidExecutionContract(manifest.executionContract, {
        nodeId,
        type: manifestType,
      });
    } catch (err) {
      pushError(
        errors,
        `Node ${nodeId}: missing or invalid ExecutionContract — ${err instanceof Error ? err.message : err}`,
      );
      continue;
    }

    const payload = node?.payload && typeof node.payload === 'object' ? node.payload : {};
    const parsed = manifest.inputs.schema.safeParse({ props: payload });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'invalid input schema';
      pushError(errors, `Node ${nodeId} (${manifestType}): input schema violation — ${msg}`);
      continue;
    }

    if (manifest.validateProps) {
      const reason = manifest.validateProps(parsed.data.props);
      if (reason) {
        pushError(errors, `Node ${nodeId} (${manifestType}): ${reason}`);
      }
    }
  }

  for (const edge of edges) {
    const edgeId = String(edge?.id ?? `${edge?.from}->${edge?.to}`);
    const from = String(edge?.from ?? edge?.source ?? '').trim();
    const to = String(edge?.to ?? edge?.target ?? '').trim();

    if (!from || !to) {
      pushError(errors, `Edge ${edgeId}: missing from/to endpoint`);
      continue;
    }

    if (from === to) {
      pushError(errors, `Edge ${edgeId}: self-loop on node ${from}`);
      continue;
    }

    const sourceNode = nodeById.get(from);
    const targetNode = nodeById.get(to);

    if (!sourceNode) {
      pushError(errors, `Edge ${edgeId}: source node "${from}" does not exist`);
      continue;
    }
    if (!targetNode) {
      pushError(errors, `Edge ${edgeId}: target node "${to}" does not exist`);
      continue;
    }

    const sourceManifest = resolveManifestBlockTypeForFlowNode(sourceNode);
    const targetManifest = resolveManifestBlockTypeForFlowNode(targetNode);

    if (!sourceManifest || !targetManifest) {
      continue;
    }

    const { sourcePort, targetPort } = resolveFlowEdgePorts(edge, sourceNode);
    const compat = canConnect(
      sourceManifest,
      targetManifest,
      sourcePort,
      targetPort,
    );

    if (!compat.ok) {
      pushError(
        errors,
        `Edge ${edgeId} (${from}[${sourceManifest}].${sourcePort} → ${to}[${targetManifest}].${targetPort}): ${compat.reason}`,
      );
    }
  }

  if (errors.length) {
    throw new StrictExecutionCompilerError(errors);
  }

  return normalized;
}
