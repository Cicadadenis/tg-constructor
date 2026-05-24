/**
 * Bot IR → Execution IR (TypeScript; used by compiler pipeline).
 */

import { createHash } from "node:crypto";
import type { BotIRGraph } from "../../ir/bot_ir.js";
import { resolveNodeCapability } from "../../capabilities/resolveNodeCapability.js";
import { CAPABILITY_ACTIONS } from "../../capabilities/capabilityIds.mjs";
import {
  EXECUTION_IR_VERSION,
  freezeExecutionIrPlan,
  type ExecutionIrPlan,
  type ExecutionIrStep,
  type ForkBranch,
  type JoinBarrier,
} from "./executionIr.js";

const DEFAULT_RETRY = Object.freeze({ maxAttempts: 3, backoffMs: 50 });

function stablePlanId(parts: unknown): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16);
}

function stepIdForNode(nodeId: string): string {
  return `ex_${nodeId}`;
}

export function buildExecutionIrFromBotIr(botIr: BotIRGraph): ExecutionIrPlan {
  const steps: ExecutionIrStep[] = [];
  const barriers: JoinBarrier[] = [];
  const outgoing = new Map<string, typeof botIr.edges>();
  const incoming = new Map<string, number>();

  for (const edge of botIr.edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    outgoing.get(edge.source)!.push(edge);
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  }

  for (const node of botIr.nodes) {
    const resolved = resolveNodeCapability(node.type, { nodeId: node.id, strict: true });
    const outs = outgoing.get(node.id) || [];
    const sid = stepIdForNode(node.id);

    if (outs.length > 1 && outs.some((e) => e.condition)) {
      const forkBranches: ForkBranch[] = outs.map((e, i) => ({
        branchId: `branch_${i}_${node.id}`,
        entryStepId: stepIdForNode(e.target),
        label: e.condition || e.label,
      }));
      const barrierId = `join_${node.id}`;
      const mergeStepId = `ex_join_${node.id}`;
      barriers.push({
        barrierId,
        requiredBranchIds: forkBranches.map((b) => b.branchId),
        mergeStepId,
      });
      steps.push({
        stepId: sid,
        kind: "fork",
        capabilityId: CAPABILITY_ACTIONS.BRANCH,
        payload: { ...node.payload },
        successors: [mergeStepId],
        forkBranches,
        retry: DEFAULT_RETRY,
        sourceNodeId: node.id,
      });
      steps.push({
        stepId: mergeStepId,
        kind: "join",
        payload: {},
        successors: [],
        joinBarrierId: barrierId,
        sourceNodeId: node.id,
      });
      continue;
    }

    steps.push({
      stepId: sid,
      kind: resolved.primaryAction === CAPABILITY_ACTIONS.HALT ? "halt" : "action",
      capabilityId: resolved.primaryAction,
      payload: { ...node.payload },
      successors: outs.map((e) => stepIdForNode(e.target)),
      retry: DEFAULT_RETRY,
      sourceNodeId: node.id,
    });
  }

  const entryNode = botIr.nodes.find((n) => (incoming.get(n.id) ?? 0) === 0) || botIr.nodes[0];
  const entryStepId = entryNode ? stepIdForNode(entryNode.id) : steps[0]?.stepId || "ex_start";

  return freezeExecutionIrPlan({
    version: EXECUTION_IR_VERSION,
    planId: stablePlanId({
      nodes: botIr.nodes.map((n) => n.id),
      edges: botIr.edges.map((e) => e.id),
    }),
    entryStepId,
    steps,
    barriers,
    metadata: {
      source: "bot_ir",
      nodeCount: botIr.nodes.length,
      edgeCount: botIr.edges.length,
      botIrVersion: botIr.version,
    },
  });
}
