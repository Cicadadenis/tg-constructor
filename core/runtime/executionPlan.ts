/**
 * Immutable Bot IR execution plan — capability steps (not block-type switches).
 */

import type { BotIRGraph, BotIREdge, BotIRNode } from "../ir/bot_ir.js";
import { resolveNodeCapability } from "../capabilities/resolveNodeCapability.js";
import { BOT_IR_VERSION } from "../ir/bot_ir.js";

export const EXECUTION_PLAN_VERSION = "1.0";

export interface PlanEdgeRef {
  readonly targetStepId: string;
  readonly port: string;
  readonly condition?: string;
}

export interface CapabilityPlanStep {
  readonly stepId: string;
  readonly nodeId: string;
  readonly blockType: string;
  readonly capabilityId: string;
  readonly capabilityIds: readonly string[];
  readonly triggerIds: readonly string[];
  readonly async: boolean;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly outgoing: readonly PlanEdgeRef[];
}

export interface BotExecutionPlan {
  readonly version: string;
  readonly planVersion: string;
  readonly steps: readonly CapabilityPlanStep[];
  readonly stepByNodeId: Readonly<Record<string, string>>;
  readonly entryStepIds: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

function freezePlanEdge(edge: PlanEdgeRef): PlanEdgeRef {
  return Object.freeze({ ...edge });
}

function freezeStep(step: CapabilityPlanStep): CapabilityPlanStep {
  return Object.freeze({
    ...step,
    capabilityIds: Object.freeze([...step.capabilityIds]),
    triggerIds: Object.freeze([...step.triggerIds]),
    payload: Object.freeze({ ...step.payload }),
    outgoing: Object.freeze(step.outgoing.map(freezePlanEdge)),
  });
}

function buildOutgoing(
  nodeId: string,
  edges: BotIREdge[],
  stepByNodeId: Map<string, string>,
): PlanEdgeRef[] {
  const out: PlanEdgeRef[] = [];
  for (const edge of edges) {
    if (edge.source !== nodeId) continue;
    const targetStepId = stepByNodeId.get(edge.target);
    if (!targetStepId) continue;
    out.push(
      freezePlanEdge({
        targetStepId,
        port: edge.sourcePort || "flow",
        ...(edge.condition ? { condition: edge.condition } : {}),
      }),
    );
  }
  return out.sort((a, b) => a.targetStepId.localeCompare(b.targetStepId));
}

function isEntryNode(node: BotIRNode, incoming: Map<string, number>): boolean {
  const count = incoming.get(node.id) ?? 0;
  if (count === 0) return true;
  return (node.capabilities.triggers?.length ?? 0) > 0;
}

/**
 * Lower Bot IR → immutable capability execution plan.
 */
export function buildExecutionPlan(botIr: BotIRGraph): BotExecutionPlan {
  const steps: CapabilityPlanStep[] = [];
  const stepByNodeId = new Map<string, string>();
  const incoming = new Map<string, number>();

  for (const edge of botIr.edges) {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  }

  for (const node of botIr.nodes) {
    const resolved = resolveNodeCapability(node.type, {
      nodeId: node.id,
      strict: true,
    });
    const stepId = `step_${node.id}`;
    stepByNodeId.set(node.id, stepId);

    steps.push(
      freezeStep({
        stepId,
        nodeId: node.id,
        blockType: node.type,
        capabilityId: resolved.primaryAction,
        capabilityIds: resolved.actions,
        triggerIds: resolved.triggers,
        async: resolved.async,
        payload: { ...node.payload },
        outgoing: [],
      }),
    );
  }

  const stepsWithEdges = steps.map((step) =>
    freezeStep({
      ...step,
      outgoing: buildOutgoing(step.nodeId, botIr.edges, stepByNodeId),
    }),
  );

  const entryStepIds = botIr.nodes
    .filter((node) => isEntryNode(node, incoming))
    .map((node) => stepByNodeId.get(node.id)!)
    .filter(Boolean)
    .sort();

  const stepByNodeIdRecord: Record<string, string> = {};
  for (const [nodeId, stepId] of stepByNodeId) {
    stepByNodeIdRecord[nodeId] = stepId;
  }

  return Object.freeze({
    version: botIr.version || BOT_IR_VERSION,
    planVersion: EXECUTION_PLAN_VERSION,
    steps: Object.freeze(stepsWithEdges),
    stepByNodeId: Object.freeze(stepByNodeIdRecord),
    entryStepIds: Object.freeze(entryStepIds),
    metadata: Object.freeze({
      ...botIr.context.metadata,
      nodeCount: stepsWithEdges.length,
      edgeCount: botIr.edges.length,
    }),
  });
}

export function getPlanStep(
  plan: BotExecutionPlan,
  stepId: string,
): CapabilityPlanStep | undefined {
  return plan.steps.find((s) => s.stepId === stepId);
}

export function getPlanStepByNodeId(
  plan: BotExecutionPlan,
  nodeId: string,
): CapabilityPlanStep | undefined {
  const stepId = plan.stepByNodeId[nodeId];
  return stepId ? getPlanStep(plan, stepId) : undefined;
}
