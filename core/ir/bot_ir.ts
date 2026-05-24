/**
 * Bot IR — intermediate representation between GraphDocument and compilers.
 * Canonical node type is always `node.type` (resolved via graph_node_payload).
 */

import { createGraphDocument } from "../../src/constructor/graph_document/graph_document.js";
import { graphResolveNodeType } from "../../src/constructor/graph_document/graph_node_payload.js";
import { getNodePortDescriptors } from "../../src/constructor/graph_document/operation_registry.js";
import { getNodeCapabilities } from "../blockRegistry.js";
import {
  buildVisualDbGraphFromBotNodes,
  type VisualDbGraph,
} from "../db/visual_db_ir.js";

export const BOT_IR_VERSION = "1.0";

/** Connection port on a Bot IR node (from operation registry). */
export interface BotIRPort {
  id: string;
  kind?: string;
  label?: string;
  transport?: string;
}

/** Single node in Bot IR — canonical block type + ports + capabilities + props payload. */
export interface BotIRNode {
  id: string;
  /** Canonical block type (GraphDocument `node.type`, registry-validated). */
  type: string;
  inputs: readonly BotIRPort[];
  outputs: readonly BotIRPort[];
  /** Node capability contract (triggers, actions, async, outputs). */
  capabilities: Readonly<{
    triggers?: readonly string[];
    actions?: readonly string[];
    async: boolean;
    outputs: readonly string[];
  }>;
  /** Block props only (GraphDocument `node.data`, no type mirrors). */
  payload: Record<string, unknown>;
}

/** Directed edge between Bot IR nodes. */
export interface BotIREdge {
  id: string;
  source: string;
  target: string;
  sourcePort: string;
  targetPort: string;
  label?: string;
  condition?: string;
  invalid?: boolean;
  invalidReason?: string;
}

/** Graph-level context carried alongside nodes and edges. */
export interface BotIRContext {
  schemaVersion: number;
  viewport: { x: number; y: number; zoom: number };
  metadata: Record<string, unknown>;
  revision?: number;
  nodeCount: number;
  edgeCount: number;
  dbNodeCount?: number;
}

/** Full Bot intermediate representation of a constructor graph. */
export interface BotIRGraph {
  version: string;
  nodes: BotIRNode[];
  edges: BotIREdge[];
  context: BotIRContext;
  /** Visual DB operations extracted from db.* nodes. */
  visualDb: VisualDbGraph;
}

export type { VisualDbGraph } from "../db/visual_db_ir.js";

/** Minimal GraphDocument shape accepted by {@link graphToBotIR}. */
export interface GraphDocumentInput {
  schema_version?: number;
  nodes?:
    | Record<string, GraphDocumentNodeInput>
    | GraphDocumentNodeInput[];
  edges?:
    | Record<string, GraphDocumentEdgeInput>
    | GraphDocumentEdgeInput[];
  viewport?: { x?: number; y?: number; zoom?: number; scale?: number };
  metadata?: Record<string, unknown>;
  ui_state?: unknown;
}

export interface GraphDocumentNodeInput {
  id: string;
  type?: string;
  position?: { x?: number; y?: number };
  data?: Record<string, unknown>;
  props?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface GraphDocumentEdgeInput {
  id: string;
  source?: string;
  target?: string;
  from?: string;
  to?: string;
  sourcePort?: string;
  sourceHandle?: string;
  targetPort?: string;
  targetHandle?: string;
  label?: string;
  condition?: string;
  invalid?: boolean;
  invalidReason?: string;
}

type RegistryPort = {
  id: string;
  kind?: string;
  label?: string;
  transport?: string;
};

function mapPorts(ports: readonly RegistryPort[]): BotIRPort[] {
  return ports.map((p) => ({
    id: String(p.id),
    ...(p.kind != null ? { kind: String(p.kind) } : {}),
    ...(p.label != null ? { label: String(p.label) } : {}),
    ...(p.transport != null ? { transport: String(p.transport) } : {}),
  }));
}

function sortById<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

function documentNodeToBotIRNode(node: {
  id: string;
  type?: string;
  data?: Record<string, unknown>;
}): BotIRNode {
  const type = graphResolveNodeType(node);
  const { inputs, outputs } = getNodePortDescriptors(type);
  const data = node.data && typeof node.data === "object" ? node.data : {};
  return {
    id: String(node.id),
    type,
    inputs: Object.freeze(mapPorts(inputs as RegistryPort[])),
    outputs: Object.freeze(mapPorts(outputs as RegistryPort[])),
    capabilities: Object.freeze({ ...getNodeCapabilities(type) }),
    payload: Object.freeze({ ...data }),
  };
}

function documentEdgeToBotIREdge(edge: {
  id: string;
  source: string;
  target: string;
  sourcePort?: string;
  targetPort?: string;
  label?: string;
  condition?: string;
  invalid?: boolean;
  invalidReason?: string;
}): BotIREdge {
  return {
    id: String(edge.id),
    source: String(edge.source),
    target: String(edge.target),
    sourcePort: String(edge.sourcePort ?? "flow"),
    targetPort: String(edge.targetPort ?? "flow"),
    ...(edge.label ? { label: String(edge.label) } : {}),
    ...(edge.condition ? { condition: String(edge.condition) } : {}),
    ...(edge.invalid ? { invalid: true } : {}),
    ...(edge.invalidReason
      ? { invalidReason: String(edge.invalidReason) }
      : {}),
  };
}

/**
 * Lower GraphDocument → Bot IR (read-only; does not mutate the source document).
 */
export function graphToBotIR(graphDocument: GraphDocumentInput): BotIRGraph {
  const doc = createGraphDocument(graphDocument);
  const nodes = sortById(
    Object.values(doc.nodes).map((node) => documentNodeToBotIRNode(node)),
  );
  const edges = sortById(
    Object.values(doc.edges).map((edge) => documentEdgeToBotIREdge(edge)),
  );
  const meta = (doc.metadata || {}) as Record<string, unknown>;

  const visualDb = buildVisualDbGraphFromBotNodes(nodes);

  return {
    version: BOT_IR_VERSION,
    nodes,
    edges,
    visualDb,
    context: {
      schemaVersion: doc.schema_version,
      viewport: { ...doc.viewport },
      metadata: { ...meta },
      revision:
        typeof meta.revision === "number" ? meta.revision : undefined,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      dbNodeCount: visualDb.nodeCount,
    },
  };
}
