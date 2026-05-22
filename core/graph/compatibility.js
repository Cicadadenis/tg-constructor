// Centralized compatibility helpers for graph ports/nodes
// Lightweight adapter that reuses the graph semantic layer where possible.
import {
  getOperationContract,
  canConnect as registryCanConnect,
  validateConnection as registryValidateConnection,
  validateGraph as registryValidateGraph,
} from '../../src/constructor/graph_document/operation_registry.js';

// isCompatible: compares two port descriptors or port id strings.
// Accepts either objects { transport, kind } or a string transport id.
export function isCompatible(sourcePort, targetPort) {
  if (!sourcePort || !targetPort) return { ok: false, reason: 'Missing port descriptor' };
  const sTransport = typeof sourcePort === 'string' ? sourcePort : sourcePort.transport;
  const tTransport = typeof targetPort === 'string' ? targetPort : targetPort.transport;
  const sKind = typeof sourcePort === 'string' ? 'flow' : sourcePort.kind || 'flow';
  const tKind = typeof targetPort === 'string' ? 'flow' : targetPort.kind || 'flow';
  // wildcard transport support: '*' matches anything
  if (sTransport !== '*' && tTransport !== '*' && sTransport !== tTransport) {
    return { ok: false, reason: `port transport mismatch (${sTransport} → ${tTransport})` };
  }
  // simple kind compatibility: condition true/false and loop/body/done map to flow
  const kindCompat = (s, t) => {
    if (!s || !t) return false;
    if (s === t) return true;
    // condition branches route into flow
    if ((s === 'true' || s === 'false' || s === 'body' || s === 'done') && t === 'flow') return true;
    return false;
  };
  if (!kindCompat(sKind, tKind)) return { ok: false, reason: `port kind incompatible (${sKind} → ${tKind})` };
  return { ok: true };
}

// getCompatibleTargets: enumerate nodes in a graph that accept connections
// from given source node/port. Returns array of { nodeId, portId }.
export function getCompatibleTargets(graphDocument, sourceNodeId, sourcePortId = null) {
  const out = [];
  const nodes = graphDocument?.nodes || {};
  const srcNode = nodes[sourceNodeId];
  if (!srcNode) return out;
  for (const [id, node] of Object.entries(nodes)) {
    if (id === sourceNodeId) continue;
    const contract = getOperationContract(node.type);
    const targets = contract.inputs || [];
    for (const p of targets) {
      const compat = isCompatible({ transport: sourcePortId || (getOperationContract(srcNode.type).outputs[0]?.transport || 'flow'), kind: 'flow' }, p);
      if (compat.ok) out.push({ nodeId: id, portId: p.id });
    }
  }
  return out;
}

// validateConnection: adapter accepting an edge-like object or params and delegating
// to registryValidateConnection when possible. Keeps backward-compatible contract.
export function validateConnection(documentOrParams, maybeParams) {
  // Support two-call signatures: (document, params) or (params) if document included in params
  let document = null;
  let params = null;
  if (maybeParams) {
    document = documentOrParams;
    params = maybeParams;
  } else {
    params = documentOrParams;
  }
  // If registry available, use it for full validation
  try {
    return registryValidateConnection(document, params);
  } catch (err) {
    return { ok: false, reason: err?.message || 'validation failed' };
  }
}

// validateGraph: validation wrapper
export function validateGraph(graphDocument) {
  try {
    return registryValidateGraph(graphDocument);
  } catch (err) {
    return { ok: false, errors: [err?.message || 'validation failed'], warnings: [] };
  }
}
