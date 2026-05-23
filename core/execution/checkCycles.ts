import type {
  ExecutionEdge,
  ExecutionGraph,
  ExecutionTrigger,
  NodeId,
} from "./executionContract";

export interface CycleEdgeStep {
  from: NodeId;
  to: NodeId;
  trigger: ExecutionTrigger;
  condition?: string;
}

export interface CycleCheckResult {
  hasCycle: boolean;
  /** Closed node paths: [A, B, C, A] */
  cycles: NodeId[][];
  /** Parallel edge chains for each cycle (debug trace). */
  edgeChains: CycleEdgeStep[][];
}

enum VisitColor {
  White = 0,
  Gray = 1,
  Black = 2,
}

function buildOutgoingAdjacency(
  execution: ExecutionGraph,
): Map<NodeId, ExecutionEdge[]> {
  const adjacency = new Map<NodeId, ExecutionEdge[]>();

  const ensure = (nodeId: NodeId) => {
    if (!adjacency.has(nodeId)) adjacency.set(nodeId, []);
  };

  for (const node of execution.nodes) ensure(node.id);
  for (const edge of execution.edges) {
    ensure(edge.from);
    ensure(edge.to);
    adjacency.get(edge.from)!.push(edge);
  }

  return adjacency;
}

function toEdgeStep(edge: ExecutionEdge): CycleEdgeStep {
  return {
    from: edge.from,
    to: edge.to,
    trigger: edge.trigger,
    ...(edge.condition !== undefined ? { condition: edge.condition } : {}),
  };
}

function normalizeCycle(nodes: NodeId[]): { key: string; path: NodeId[] } {
  const core =
    nodes.length > 1 && nodes[0] === nodes[nodes.length - 1]
      ? nodes.slice(0, -1)
      : [...nodes];

  if (core.length === 0) {
    return { key: "", path: nodes };
  }

  let bestRotation = core;
  let bestKey = core.join("\0");

  for (let i = 1; i < core.length; i++) {
    const rotation = [...core.slice(i), ...core.slice(0, i)];
    const key = rotation.join("\0");
    if (key < bestKey) {
      bestKey = key;
      bestRotation = rotation;
    }
  }

  return {
    key: bestKey,
    path: [...bestRotation, bestRotation[0]!],
  };
}

function formatEdgeStep(step: CycleEdgeStep): string {
  const label =
    step.condition !== undefined && step.condition !== ""
      ? `${step.trigger}:${step.condition}`
      : step.trigger;
  return `${step.from} --[${label}]--> ${step.to}`;
}

/**
 * Detect cycles in ExecutionGraph via DFS color marking.
 * Considers every edge in `execution.edges` regardless of trigger.
 */
export function checkCycles(execution: ExecutionGraph): CycleCheckResult {
  const adjacency = buildOutgoingAdjacency(execution);
  const color = new Map<NodeId, VisitColor>();
  const cycles: NodeId[][] = [];
  const edgeChains: CycleEdgeStep[][] = [];
  const seenCycleKeys = new Set<string>();

  for (const nodeId of adjacency.keys()) {
    color.set(nodeId, VisitColor.White);
  }

  const pathNodes: NodeId[] = [];
  const pathEdges: ExecutionEdge[] = [];

  const recordCycle = (startIndex: number, closingEdge: ExecutionEdge) => {
    const cycleNodes = [...pathNodes.slice(startIndex), pathNodes[startIndex]!];
    const cycleEdgeSteps = [
      ...pathEdges.slice(startIndex).map(toEdgeStep),
      toEdgeStep(closingEdge),
    ];
    const { key, path } = normalizeCycle(cycleNodes);

    if (seenCycleKeys.has(key)) return;
    seenCycleKeys.add(key);

    cycles.push(path);
    edgeChains.push(cycleEdgeSteps);
  };

  const dfs = (nodeId: NodeId): void => {
    color.set(nodeId, VisitColor.Gray);
    pathNodes.push(nodeId);

    for (const edge of adjacency.get(nodeId) ?? []) {
      const target = edge.to;
      const targetColor = color.get(target) ?? VisitColor.White;

      if (targetColor === VisitColor.Gray) {
        const startIndex = pathNodes.indexOf(target);
        if (startIndex >= 0) {
          recordCycle(startIndex, edge);
        }
        continue;
      }

      if (targetColor === VisitColor.White) {
        pathEdges.push(edge);
        dfs(target);
        pathEdges.pop();
      }
    }

    pathNodes.pop();
    color.set(nodeId, VisitColor.Black);
  };

  for (const nodeId of adjacency.keys()) {
    if ((color.get(nodeId) ?? VisitColor.White) === VisitColor.White) {
      dfs(nodeId);
    }
  }

  return {
    hasCycle: cycles.length > 0,
    cycles,
    edgeChains,
  };
}

/** Human-readable debug trace for build errors and inspectors. */
export function formatCycleDebugTrace(
  cycles: NodeId[][],
  edgeChains: CycleEdgeStep[][] = [],
): string {
  if (cycles.length === 0) return "No cycles detected.";

  return cycles
    .map((cycle, index) => {
      const chain = edgeChains[index] ?? [];
      const nodePath = cycle.join(" -> ");
      const edgePath =
        chain.length > 0
          ? chain.map(formatEdgeStep).join("\n    ")
          : "(edge chain unavailable)";

      return [
        `Cycle ${index + 1}: ${nodePath}`,
        `  edge chain:`,
        `    ${edgePath}`,
      ].join("\n");
    })
    .join("\n\n");
}
