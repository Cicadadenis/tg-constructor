import { createHash } from 'node:crypto';
import { CAPABILITY_ACTIONS } from '../../capabilities/capabilityIds.mjs';
import {
  EXECUTION_IR_VERSION,
  freezeExecutionIrPlan,
} from './executionIrCore.mjs';
import { capabilityForFlowNode, payloadForFlowNode } from './flowNodeCapabilities.mjs';

const DEFAULT_RETRY = Object.freeze({ maxAttempts: 3, backoffMs: 50 });

function stablePlanId(parts) {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 16);
}

function stepIdForNode(nodeId) {
  return `ex_${nodeId}`;
}

function outgoingEdges(edges, fromId, kindFilter) {
  return edges.filter((e) => {
    if (e.from !== fromId) return false;
    if (!kindFilter?.length) return e.kind === 'flow' || !e.kind;
    return kindFilter.includes(String(e.kind || 'flow'));
  });
}

function incomingEdges(edges, toId) {
  return edges.filter((e) => e.to === toId);
}

export function buildExecutionIrFromFlowGraph(flowGraph) {
  const nodes = flowGraph.nodes || [];
  const edges = flowGraph.edges || [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const steps = [];
  const barriers = [];

  for (const merge of nodes.filter((n) => n.type === 'merge')) {
    const incoming = incomingEdges(edges, merge.id);
    const branchIds = incoming.map((e) => {
      const src = nodeById.get(e.from);
      if (src?.type === 'branch_arm') {
        return `branch_${src.payload?.arm || 'x'}_${e.from}`;
      }
      return `branch_${e.from}`;
    });
    const barrierId = `join_${merge.id}`;
    const mergeStepId = stepIdForNode(merge.id);
    barriers.push({
      barrierId,
      requiredBranchIds: [...new Set(branchIds)],
      mergeStepId,
    });
    const step = {
      stepId: mergeStepId,
      kind: 'join',
      payload: {},
      successors: [],
      joinBarrierId: barrierId,
      sourceNodeId: merge.id,
    };
    const afterMerge = outgoingEdges(edges, merge.id);
    if (afterMerge.length) step.successors = [stepIdForNode(afterMerge[0].to)];
    steps.push(step);
  }

  for (const branch of nodes.filter((n) => n.type === 'branch')) {
    const trueEdge = outgoingEdges(edges, branch.id, ['true'])[0];
    const falseEdge = outgoingEdges(edges, branch.id, ['false'])[0];
    const forkBranches = [];
    if (trueEdge) {
      forkBranches.push({
        branchId: `branch_true_${branch.id}`,
        entryStepId: stepIdForNode(trueEdge.to),
        label: 'true',
      });
    }
    if (falseEdge) {
      forkBranches.push({
        branchId: `branch_false_${branch.id}`,
        entryStepId: stepIdForNode(falseEdge.to),
        label: 'false',
      });
    }
    const mergeTarget = edges.find((e) => e.from === branch.id && nodeById.get(e.to)?.type === 'merge');
    const successors = mergeTarget ? [stepIdForNode(mergeTarget.to)] : [];
    steps.push({
      stepId: stepIdForNode(branch.id),
      kind: 'fork',
      capabilityId: CAPABILITY_ACTIONS.BRANCH,
      payload: payloadForFlowNode(branch),
      successors,
      forkBranches,
      retry: DEFAULT_RETRY,
      sourceNodeId: branch.id,
    });
  }

  const skipTypes = new Set(['merge', 'branch', 'branch_arm', 'entry', 'root']);
  for (const node of nodes) {
    if (skipTypes.has(node.type)) continue;
    if (steps.some((s) => s.sourceNodeId === node.id)) continue;
    const outs = outgoingEdges(edges, node.id);
    steps.push({
      stepId: stepIdForNode(node.id),
      kind: node.type === 'terminal' ? 'halt' : 'action',
      capabilityId: capabilityForFlowNode(node),
      payload: payloadForFlowNode(node),
      successors: outs.map((e) => stepIdForNode(e.to)),
      retry: node.type === 'collect' ? DEFAULT_RETRY : undefined,
      sourceNodeId: node.id,
    });
  }

  const root = nodes.find((n) => n.type === 'entry' || String(n.id).includes('root')) ||
    nodes.find((n) => n.type === 'interaction');
  const rootOut = root ? outgoingEdges(edges, root.id)[0] : edges[0];
  let entryStepId = steps[0]?.stepId || 'ex_start';
  if (rootOut) {
    const target = nodeById.get(rootOut.to);
    entryStepId = target?.type === 'branch' ? stepIdForNode(target.id) : stepIdForNode(rootOut.to);
  }

  return freezeExecutionIrPlan({
    version: EXECUTION_IR_VERSION,
    planId: stablePlanId({ nodes: nodes.map((n) => n.id), edges }),
    entryStepId,
    steps,
    barriers,
    metadata: {
      source: 'flow_graph',
      nonLinear: Boolean(flowGraph.nonLinear),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      capabilities: flowGraph.capabilities || [],
      ...(flowGraph.metadata || {}),
    },
  });
}
