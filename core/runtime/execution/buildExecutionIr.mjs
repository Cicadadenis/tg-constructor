import { createHash } from 'node:crypto';

import { CAPABILITY_ACTIONS } from '../../capabilities/capabilityIds.mjs';

import {

  EXECUTION_IR_VERSION,

  freezeExecutionIrPlan,

} from './executionIrCore.mjs';

import { capabilityForFlowNode, payloadForFlowNode } from './flowNodeCapabilities.mjs';

import { assertGraphExecutionIrCompilePath } from '../legacyExecutionPolicy.mjs';

import { resolveExecutionContractForFlowNode } from '../../node_manifest/validateFlowGraphExecutionContracts.mjs';

import {

  executionContractToRetryPolicy,

  freezeExecutionContract,

} from '../../node_manifest/executionContract.mjs';

import { ExecutionError } from './executionErrors.mjs';



const STRUCTURAL_SKIP = Object.freeze(

  new Set(['entry', 'root', 'interaction', 'task_entry', 'branch_arm']),

);



const COMPILE_PATH = Object.freeze(['compile:flow_graph']);



function stablePlanId(parts) {

  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 16);

}



function stepIdForNode(nodeId) {

  return `ex_${nodeId}`;

}



function flowNodeType(node) {

  return String(node?.payload?._plannerType ?? node?.type ?? 'unknown');

}



/**

 * @param {Map<string, object>} nodeById

 * @param {string} nodeId

 * @param {readonly string[]} path

 */

function requireFlowNode(nodeById, nodeId, path) {

  const node = nodeById.get(nodeId);

  if (!node) {

    throw ExecutionError.missingNode(nodeId, null, path);

  }

  return node;

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



function isMergeNode(node) {

  return node?.type === 'action' && node?.payload?.structuralType === 'merge';

}



function isBranchArmNode(node) {

  return node?.type === 'action' && node?.payload?.structuralType === 'branch_arm';

}



function shouldSkipStructuralStep(node) {

  const st = node?.payload?.structuralType;

  return node?.type === 'action' && st && STRUCTURAL_SKIP.has(st);

}



function isExecutableFlowNode(node) {

  if (!node?.id) return false;

  if (isMergeNode(node)) return false;

  if (node.type === 'condition') return false;

  if (shouldSkipStructuralStep(node)) return false;

  return true;

}



/**

 * @param {string} startNodeId

 * @param {Map<string, object>} nodeById

 * @param {object[]} edges

 * @param {readonly string[]} path

 */

function resolveExecutableEntryStepId(startNodeId, nodeById, edges, path) {

  let current = startNodeId;

  const seen = new Set();



  while (current && !seen.has(current)) {

    seen.add(current);

    const node = requireFlowNode(nodeById, current, path);

    if (isExecutableFlowNode(node)) {

      return stepIdForNode(node.id);

    }

    const outs = outgoingEdges(edges, current);

    if (!outs.length) {

      throw ExecutionError.invalidTransition(

        { sourceNodeId: current, kind: flowNodeType(node) },

        'structural node has no outgoing flow edge to an executable successor',

        [...path, current],

      );

    }

    if (outs.length > 1) {

      throw ExecutionError.invalidTransition(

        { sourceNodeId: current, kind: flowNodeType(node) },

        `structural node has ${outs.length} outgoing flow edges (expected 1)`,

        [...path, current],

      );

    }

    current = outs[0].to;

  }



  throw ExecutionError.invalidTransition(

    { sourceNodeId: startNodeId, kind: 'entry' },

    'could not resolve executable entry through structural nodes',

    path,

  );

}



/**

 * @param {object} node

 * @returns {{ executionContract: object, retry: object | undefined, payload: object }}

 */

function stepContractBundle(node) {

  const { contract, manifestBlockType } = resolveExecutionContractForFlowNode(node);

  const frozen = freezeExecutionContract(contract);

  const basePayload = payloadForFlowNode(node);

  return {

    executionContract: frozen,

    retry: executionContractToRetryPolicy(frozen),

    payload: Object.freeze({

      ...basePayload,

      _manifestBlockType: manifestBlockType,

    }),

  };

}



/**

 * @param {object} flowGraph — must pass runStrictExecutionCompilerGate()

 */

export function buildExecutionIrFromFlowGraph(flowGraph) {

  assertGraphExecutionIrCompilePath('buildExecutionIrFromFlowGraph');

  const nodes = flowGraph.nodes || [];

  const edges = flowGraph.edges || [];

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const steps = [];

  const barriers = [];



  for (const edge of edges) {

    requireFlowNode(nodeById, edge.from, COMPILE_PATH);

    requireFlowNode(nodeById, edge.to, COMPILE_PATH);

  }



  for (const merge of nodes.filter(isMergeNode)) {

    const incoming = incomingEdges(edges, merge.id);

    const branchIds = incoming.map((e) => {

      const src = requireFlowNode(nodeById, e.from, [...COMPILE_PATH, merge.id]);

      if (isBranchArmNode(src)) {

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

    if (afterMerge.length > 1) {

      throw ExecutionError.invalidTransition(

        { sourceNodeId: merge.id, kind: 'join' },

        `merge node ${merge.id} has ${afterMerge.length} outgoing flow edges (expected ≤1)`,

        [...COMPILE_PATH, merge.id],

      );

    }

    if (afterMerge.length) {

      const target = requireFlowNode(nodeById, afterMerge[0].to, [...COMPILE_PATH, merge.id]);

      step.successors = [stepIdForNode(target.id)];

    }

    steps.push(step);

  }



  for (const branch of nodes.filter((n) => n.type === 'condition')) {

    const nodeType = flowNodeType(branch);

    const trueEdge = outgoingEdges(edges, branch.id, ['true'])[0];

    const falseEdge = outgoingEdges(edges, branch.id, ['false'])[0];

    if (!trueEdge && !falseEdge) {

      throw ExecutionError.missingEdge(

        branch.id,

        nodeType,

        [...COMPILE_PATH, branch.id],

        'true|false',

      );

    }

    const forkBranches = [];

    if (trueEdge) {

      requireFlowNode(nodeById, trueEdge.to, [...COMPILE_PATH, branch.id, 'true']);

      forkBranches.push({

        branchId: `branch_true_${branch.id}`,

        entryStepId: resolveExecutableEntryStepId(

          trueEdge.to,

          nodeById,

          edges,

          [...COMPILE_PATH, branch.id, 'true'],

        ),

        label: 'true',

      });

    }

    if (falseEdge) {

      requireFlowNode(nodeById, falseEdge.to, [...COMPILE_PATH, branch.id, 'false']);

      forkBranches.push({

        branchId: `branch_false_${branch.id}`,

        entryStepId: resolveExecutableEntryStepId(

          falseEdge.to,

          nodeById,

          edges,

          [...COMPILE_PATH, branch.id, 'false'],

        ),

        label: 'false',

      });

    }

    const mergeTarget = edges.find(

      (e) => e.from === branch.id && isMergeNode(nodeById.get(e.to) || {}),

    );

    const successors = mergeTarget ? [stepIdForNode(mergeTarget.to)] : [];

    const branchBundle = stepContractBundle(branch);

    steps.push({

      stepId: stepIdForNode(branch.id),

      kind: 'fork',

      capabilityId: CAPABILITY_ACTIONS.BRANCH,

      payload: branchBundle.payload,

      successors,

      forkBranches,

      executionContract: branchBundle.executionContract,

      retry: branchBundle.retry,

      sourceNodeId: branch.id,

    });

  }



  for (const node of nodes) {

    if (!isExecutableFlowNode(node)) continue;

    if (steps.some((s) => s.sourceNodeId === node.id)) {

      throw ExecutionError.invalidStep(

        { sourceNodeId: node.id, kind: flowNodeType(node) },

        'duplicate execution step for flow node',

        [...COMPILE_PATH, node.id],

      );

    }



    const outs = outgoingEdges(edges, node.id);

    const isHalt = node.type === 'action' && (node.payload?.halt || node.payload?._plannerType === 'terminal');



    const bundle = stepContractBundle(node);

    const successors = outs.map((e) => {

      requireFlowNode(nodeById, e.to, [...COMPILE_PATH, node.id]);

      return stepIdForNode(e.to);

    });



    steps.push({

      stepId: stepIdForNode(node.id),

      kind: isHalt ? 'halt' : 'action',

      capabilityId: capabilityForFlowNode(node),

      payload: bundle.payload,

      successors,

      executionContract: bundle.executionContract,

      retry: bundle.retry,

      sourceNodeId: node.id,

    });

  }



  const root = nodes.find(

    (n) => n.payload?.structuralType === 'entry' || String(n.id).includes('root'),

  ) || nodes.find((n) => n.payload?.structuralType === 'interaction');

  const rootOut = root ? outgoingEdges(edges, root.id)[0] : edges[0];

  let entryStepId = steps[0]?.stepId;

  if (!entryStepId) {

    throw ExecutionError.invalidStep(

      { sourceNodeId: 'entry', kind: 'plan' },

      'flow graph produced no execution steps',

      COMPILE_PATH,

    );

  }

  if (rootOut) {

    const entryNodeId = root ? rootOut.to : rootOut.from;

    const entryPath = [...COMPILE_PATH, root?.id ?? 'entry'];

    const entryNode = requireFlowNode(nodeById, entryNodeId, entryPath);

    if (entryNode.type === 'condition') {

      entryStepId = stepIdForNode(entryNode.id);

    } else {

      entryStepId = resolveExecutableEntryStepId(

        entryNodeId,

        nodeById,

        edges,

        entryPath,

      );

    }

  }



  const stepIds = new Set(steps.map((s) => s.stepId));

  if (!stepIds.has(entryStepId)) {

    throw ExecutionError.missingStep(entryStepId, [...COMPILE_PATH, 'entry']);

  }



  for (const step of steps) {

    for (const succ of step.successors) {

      if (!stepIds.has(succ)) {

        throw ExecutionError.missingSuccessor(step, succ, COMPILE_PATH);

      }

    }

    if (step.forkBranches) {

      for (const br of step.forkBranches) {

        if (!stepIds.has(br.entryStepId)) {

          throw ExecutionError.missingSuccessor(step, br.entryStepId, COMPILE_PATH);

        }

      }

    }

  }



  for (const node of nodes) {

    if (!isExecutableFlowNode(node)) continue;

    if (!steps.some((s) => s.sourceNodeId === node.id)) {

      throw ExecutionError.invalidStep(

        { sourceNodeId: node.id, kind: flowNodeType(node) },

        'executable flow node has no Execution IR step',

        [...COMPILE_PATH, node.id],

      );

    }

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


