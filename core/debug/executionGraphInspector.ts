import { checkCycles, formatCycleDebugTrace } from "../execution/checkCycles";
import type {
  ExecutionEdge,
  ExecutionGraph,
  ExecutionNode,
  ExecutionTrigger,
  NodeId,
} from "../execution/executionContract";

const TRIGGER_MARK: Record<ExecutionTrigger, string> = {
  next: "→",
  callback: "⚡",
  state: "◆",
};

function nodeLabel(node: ExecutionNode | undefined, nodeId: NodeId): string {
  if (!node) return nodeId;
  return `${nodeId} (${node.type})`;
}

function formatEdgeLine(edge: ExecutionEdge): string {
  const mark = TRIGGER_MARK[edge.trigger] ?? "?";
  const condition =
    edge.condition !== undefined && edge.condition !== ""
      ? `:${edge.condition}`
      : "";
  return `${mark} ${edge.from} --[${edge.trigger}${condition}]--> ${edge.to}`;
}

function buildNodeIndex(
  graph: ExecutionGraph,
): Map<NodeId, ExecutionNode | undefined> {
  const index = new Map<NodeId, ExecutionNode | undefined>();
  for (const node of graph.nodes) index.set(node.id, node);
  for (const edge of graph.edges) {
    if (!index.has(edge.from)) index.set(edge.from, undefined);
    if (!index.has(edge.to)) index.set(edge.to, undefined);
  }
  return index;
}

function buildOutgoing(graph: ExecutionGraph): Map<NodeId, ExecutionEdge[]> {
  const outgoing = new Map<NodeId, ExecutionEdge[]>();
  const ensure = (nodeId: NodeId) => {
    if (!outgoing.has(nodeId)) outgoing.set(nodeId, []);
  };

  for (const node of graph.nodes) ensure(node.id);
  for (const edge of graph.edges) {
    ensure(edge.from);
    ensure(edge.to);
    outgoing.get(edge.from)!.push(edge);
  }

  for (const edges of outgoing.values()) {
    edges.sort((a, b) => {
      const ka = `${a.trigger}\0${a.to}\0${a.condition ?? ""}`;
      const kb = `${b.trigger}\0${b.to}\0${b.condition ?? ""}`;
      return ka.localeCompare(kb);
    });
  }

  return outgoing;
}

function findEntryNodes(graph: ExecutionGraph): NodeId[] {
  const incoming = new Set<NodeId>();
  for (const edge of graph.edges) incoming.add(edge.to);

  const entries = graph.nodes
    .map((node) => node.id)
    .filter((nodeId) => !incoming.has(nodeId));

  if (entries.length > 0) return entries.sort();

  const all = [...buildOutgoing(graph).keys()].sort();
  return all.length > 0 ? [all[0]!] : [];
}

function renderAsciiTree(graph: ExecutionGraph): string[] {
  const nodeIndex = buildNodeIndex(graph);
  const outgoing = buildOutgoing(graph);
  const entries = findEntryNodes(graph);
  const lines: string[] = [];
  const visited = new Set<NodeId>();

  const walk = (nodeId: NodeId, prefix: string, isLast: boolean) => {
    const branch = isLast ? "└─ " : "├─ ";
    lines.push(`${prefix}${branch}${nodeLabel(nodeIndex.get(nodeId), nodeId)}`);
    visited.add(nodeId);

    const children = outgoing.get(nodeId) ?? [];
    const nextPrefix = `${prefix}${isLast ? "   " : "│  "}`;

    children.forEach((edge, index) => {
      const childLast = index === children.length - 1;
      const edgeMark = TRIGGER_MARK[edge.trigger] ?? "?";
      const condition =
        edge.condition !== undefined && edge.condition !== ""
          ? `:${edge.condition}`
          : "";
      lines.push(
        `${nextPrefix}${childLast ? "└─ " : "├─ "}${edgeMark} [${edge.trigger}${condition}]`,
      );

      const childPrefix = `${nextPrefix}${childLast ? "   " : "│  "}`;
      if (visited.has(edge.to)) {
        lines.push(`${childPrefix}↺ ${edge.to} (back-edge / cycle hint)`);
      } else {
        walk(edge.to, childPrefix, true);
      }
    });
  };

  entries.forEach((entry, index) => {
    if (index > 0) lines.push("");
    lines.push(nodeLabel(nodeIndex.get(entry), entry));
    walk(entry, "", true);
  });

  const unreachable = [...outgoing.keys()]
    .filter((nodeId) => !visited.has(nodeId))
    .sort();

  if (unreachable.length > 0) {
    lines.push("");
    lines.push("Unreachable from entry nodes:");
    for (const nodeId of unreachable) {
      lines.push(`  • ${nodeLabel(nodeIndex.get(nodeId), nodeId)}`);
    }
  }

  return lines;
}

function renderEdgeList(graph: ExecutionGraph): string[] {
  const sorted = [...graph.edges].sort((a, b) => {
    const ka = `${a.from}\0${a.trigger}\0${a.to}\0${a.condition ?? ""}`;
    const kb = `${b.from}\0${b.trigger}\0${b.to}\0${b.condition ?? ""}`;
    return ka.localeCompare(kb);
  });

  return sorted.map(formatEdgeLine);
}

/**
 * ASCII tree + edge list for ExecutionGraph debugging.
 * Trigger legend: next (→), callback (⚡), state (◆).
 */
export function printExecutionGraph(graph: ExecutionGraph): string {
  const edgeLines = renderEdgeList(graph);

  const sections = [
    "ExecutionGraph",
    `version: ${graph.version}`,
    `nodes: ${graph.nodes.length}, edges: ${graph.edges.length}`,
    "",
    "Trigger legend: next → | callback ⚡ | state ◆",
    "",
    "── Tree ──",
    ...renderAsciiTree(graph),
    "",
    "── Edges ──",
    ...(edgeLines.length > 0 ? edgeLines : ["(no edges)"]),
  ];

  return sections.join("\n");
}

export interface TracePathResult {
  found: boolean;
  nodes: NodeId[];
  edges: ExecutionEdge[];
}

/** Shortest path using all execution edges regardless of trigger. */
export function tracePath(
  graph: ExecutionGraph,
  from: NodeId,
  to: NodeId,
): TracePathResult {
  if (from === to) {
    return { found: true, nodes: [from], edges: [] };
  }

  const outgoing = buildOutgoing(graph);
  const queue: NodeId[] = [from];
  const previousNode = new Map<NodeId, NodeId>();
  const previousEdge = new Map<NodeId, ExecutionEdge>();
  const visited = new Set<NodeId>([from]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of outgoing.get(current) ?? []) {
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      previousNode.set(edge.to, current);
      previousEdge.set(edge.to, edge);

      if (edge.to === to) {
        const nodes: NodeId[] = [to];
        const edges: ExecutionEdge[] = [];
        let cursor: NodeId | undefined = to;

        while (cursor !== undefined && cursor !== from) {
          const edgeStep = previousEdge.get(cursor);
          const prev = previousNode.get(cursor);
          if (!edgeStep || prev === undefined) break;
          edges.unshift(edgeStep);
          nodes.unshift(prev);
          cursor = prev;
        }

        return { found: true, nodes, edges };
      }

      queue.push(edge.to);
    }
  }

  return { found: false, nodes: [], edges: [] };
}

export function formatTracePath(result: TracePathResult): string {
  if (!result.found) return "Path not found.";

  if (result.edges.length === 0) {
    return result.nodes.join(" -> ");
  }

  const parts: string[] = [result.nodes[0]!];
  result.edges.forEach((edge, index) => {
    parts.push(formatEdgeLine(edge).replace(/^.\s*/, ""));
    parts.push(result.nodes[index + 1]!);
  });

  return parts.join("\n  then\n  ");
}

/** Forward-reachable subgraph rooted at `nodeId`. */
export function getSubgraph(
  graph: ExecutionGraph,
  nodeId: NodeId,
): ExecutionGraph {
  const outgoing = buildOutgoing(graph);
  const reachable = new Set<NodeId>();
  const stack = [nodeId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    for (const edge of outgoing.get(current) ?? []) {
      if (!reachable.has(edge.to)) {
        stack.push(edge.to);
      }
    }
  }

  const nodes = graph.nodes.filter((node) => reachable.has(node.id));
  const finalNodes: ExecutionNode[] = [...nodes];

  for (const id of reachable) {
    if (!finalNodes.some((node) => node.id === id)) {
      finalNodes.push({ id, type: "unknown", data: {} });
    }
  }

  return {
    version: graph.version,
    nodes: finalNodes.sort((a, b) => a.id.localeCompare(b.id)),
    edges: graph.edges.filter(
      (edge) => reachable.has(edge.from) && reachable.has(edge.to),
    ),
  };
}

export function highlightCycles(graph: ExecutionGraph): string {
  const { hasCycle, cycles, edgeChains } = checkCycles(graph);

  if (!hasCycle) {
    return "No cycles detected in ExecutionGraph.";
  }

  return [
    `Detected ${cycles.length} cycle(s) in ExecutionGraph:`,
    "",
    formatCycleDebugTrace(cycles, edgeChains),
    "",
    "── Graph with cycle hints ──",
    printExecutionGraph(graph),
  ].join("\n");
}
