import { FLOW_PORTS } from './flowPorts.js';
import { createProjectGraphState } from './model.js';
import {
  selectGraphCycles,
  selectGraphValidationOverlay,
  selectInvalidEdges,
} from './selectors.js';

function portFor(blockType, dir) {
  const cfg = FLOW_PORTS[blockType] || { input: 'flow', output: 'flow' };
  return dir === 'in' ? cfg.input : cfg.output;
}

export function createAdjacency(projectGraph) {
  const graph = createProjectGraphState(projectGraph);
  const outgoing = new Map();
  const incoming = new Map();
  for (const id of Object.keys(graph.nodes)) {
    outgoing.set(id, []);
    incoming.set(id, []);
  }
  for (const edge of Object.values(graph.edges)) {
    outgoing.get(edge.source)?.push(edge);
    incoming.get(edge.target)?.push(edge);
  }
  return { outgoing, incoming };
}

export function validateProjectGraph(projectGraph) {
  const graph = createProjectGraphState(projectGraph);
  const errors = [];
  const warnings = [];
  const nodes = graph.nodes;
  const edges = Object.values(graph.edges);
  const { outgoing, incoming } = createAdjacency(graph);

  for (const edge of edges) {
    const source = nodes[edge.source];
    const target = nodes[edge.target];
    if (!source || !target) {
      errors.push(`Edge ${edge.id}: unknown source/target`);
      continue;
    }
    const expectedSourcePort = portFor(source.type, 'out');
    const expectedTargetPort = portFor(target.type, 'in');
    if (expectedSourcePort == null) {
      errors.push(`Edge ${edge.id}: ${source.type} has no output port`);
    } else if ((edge.sourcePort || 'flow') !== expectedSourcePort) {
      errors.push(`Edge ${edge.id}: source port ${edge.sourcePort || 'flow'} does not match ${expectedSourcePort}`);
    }
    if (expectedTargetPort == null) {
      errors.push(`Edge ${edge.id}: ${target.type} has no input port`);
    } else if ((edge.targetPort || 'flow') !== expectedTargetPort) {
      errors.push(`Edge ${edge.id}: target port ${edge.targetPort || 'flow'} does not match ${expectedTargetPort}`);
    }
  }

  // Reuse selector-based overlay for orphan / unreachable / cycle reporting.
  const overlay = selectGraphValidationOverlay(graph);
  const cycles = selectGraphCycles(graph);
  const invalidEdges = selectInvalidEdges(graph);

  for (const item of invalidEdges) {
    errors.push(`Edge ${item.edgeId}: ${item.reason}`);
  }
  if (cycles.size) {
    errors.push(`Graph contains cycle(s): ${[...cycles].join(', ')}`);
  }

  for (const node of overlay.orphanNodes) {
    warnings.push(`Node ${node.id} (${node.type}) is orphaned`);
  }
  for (const node of overlay.unreachableNodes) {
    warnings.push(`Node ${node.id} (${node.type}) is unreachable`);
  }
  for (const item of overlay.missingOutputs) {
    const n = item.node || nodes[item.nodeId];
    if (n) warnings.push(`Node ${n.id} (${n.type}) has no outgoing edge`);
  }
  for (const item of overlay.deadBranches) {
    const n = item.node || nodes[item.nodeId];
    if (n) warnings.push(`Node ${n.id} (${n.type}) has dead branch output`);
  }

  // Surface unused legacy variables to keep linting hooks (incoming/outgoing/edges) honest.
  void incoming;
  void outgoing;

  return { ok: errors.length === 0, errors, warnings };
}
