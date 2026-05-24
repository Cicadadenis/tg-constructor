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
import { isIntentOnlyNodeType } from "./executionNodeTypes.mjs";
import { assertLegacyExecutionAllowed } from "../legacyExecutionPolicy.mjs";
import { ExecutionError } from "./executionErrors.mjs";

const DEFAULT_RETRY = Object.freeze({ maxAttempts: 3, backoffMs: 50 });
const COMPILE_PATH = Object.freeze(["compile:bot_ir"]);

function stablePlanId(parts: unknown): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16);
}

function stepIdForNode(nodeId: string): string {
  return `ex_${nodeId}`;
}

export function buildExecutionIrFromBotIr(botIr: BotIRGraph): ExecutionIrPlan {
  assertLegacyExecutionAllowed("buildExecutionIrFromBotIr");
  const steps: ExecutionIrStep[] = [];
  const barriers: JoinBarrier[] = [];
  const outgoing = new Map<string, typeof botIr.edges>();
  const incoming = new Map<string, number>();

  for (const edge of botIr.edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    outgoing.get(edge.source)!.push(edge);
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  }

  const executableNodes = botIr.nodes.filter((node) => {
    if (isIntentOnlyNodeType(node.type)) {
      throw ExecutionError.intentOnlyNode(
        node.id,
        String(node.type),
        [...COMPILE_PATH, node.id],
      );
    }
    return true;
  });
  const executableIds = new Set(executableNodes.map((n) => n.id));

  for (const edge of botIr.edges) {
    if (!executableIds.has(edge.source)) {
      throw ExecutionError.missingNode(edge.source, null, COMPILE_PATH);
    }
    if (!executableIds.has(edge.target)) {
      throw ExecutionError.missingNode(edge.target, null, COMPILE_PATH);
    }
  }

  for (const node of executableNodes) {
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

    const successors = outs.map((e) => stepIdForNode(e.target));
    steps.push({
      stepId: sid,
      kind: resolved.primaryAction === CAPABILITY_ACTIONS.HALT ? "halt" : "action",
      capabilityId: resolved.primaryAction,
      payload: { ...node.payload },
      successors,
      retry: DEFAULT_RETRY,
      sourceNodeId: node.id,
    });
  }

  const entryNode = executableNodes.find((n) => (incoming.get(n.id) ?? 0) === 0) || executableNodes[0];
  const entryStepId = entryNode ? stepIdForNode(entryNode.id) : steps[0]?.stepId;
  if (!entryStepId || !steps.some((s) => s.stepId === entryStepId)) {
    throw ExecutionError.invalidStep(
      { sourceNodeId: entryNode?.id ?? "entry", kind: "plan" },
      "Bot IR produced no valid entry execution step",
      COMPILE_PATH,
    );
  }

  const stepIds = new Set(steps.map((s) => s.stepId));
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

  return freezeExecutionIrPlan({
    version: EXECUTION_IR_VERSION,
    planId: stablePlanId({
      nodes: executableNodes.map((n) => n.id),
      edges: botIr.edges
        .filter((e) => executableIds.has(e.source) && executableIds.has(e.target))
        .map((e) => e.id),
    }),
    entryStepId,
    steps,
    barriers,
    metadata: {
      source: "bot_ir",
      nodeCount: executableNodes.length,
      edgeCount: botIr.edges.length,
      botIrVersion: botIr.version,
    },
  });
}
