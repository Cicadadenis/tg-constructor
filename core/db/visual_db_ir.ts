/**
 * Visual DB IR — graph-based database operations (db.get / db.set / db.query / …).
 * Extracted from Bot IR nodes; compiled to sqlite + aiogram handler snippets.
 */

/** Minimal node shape from Bot IR (avoids circular import with bot_ir.ts). */
export interface VisualDbBotNodeSource {
  id: string;
  type: string;
  payload: Record<string, unknown>;
}

export const VISUAL_DB_IR_VERSION = "1.0";

export const DB_NODE_TYPES = [
  "db.get",
  "db.set",
  "db.query",
  "db.insert",
  "db.update",
] as const;

export type VisualDbNodeType = (typeof DB_NODE_TYPES)[number];

export interface VisualDbNode {
  id: string;
  type: VisualDbNodeType;
  /** Target table (insert/update/query). */
  table?: string;
  /** Key column or kv key (get/set). */
  key?: string;
  /** Result / column binding variable name. */
  varname?: string;
  /** Raw SQL (query). */
  sql?: string;
  /** WHERE clause fragment (update). */
  where?: string;
  /** Row values (insert/update/set). */
  values?: Record<string, unknown>;
  /** Original block payload. */
  payload: Record<string, unknown>;
}

export interface VisualDbGraph {
  version: string;
  nodes: VisualDbNode[];
  nodeCount: number;
}

export function isDbNodeType(type: string): boolean {
  return (DB_NODE_TYPES as readonly string[]).includes(String(type || "").trim());
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown, fallback = ""): string {
  const s = String(value ?? "").trim();
  return s || fallback;
}

/**
 * Normalize a Bot IR / GraphDocument node into VisualDbNode.
 */
export function botIRNodeToVisualDb(node: VisualDbBotNodeSource): VisualDbNode | null {
  if (!isDbNodeType(node.type)) return null;
  const payload = asRecord(node.payload);
  const type = node.type as VisualDbNodeType;

  const base: VisualDbNode = {
    id: node.id,
    type,
    payload: { ...payload },
  };

  switch (type) {
    case "db.get":
      return {
        ...base,
        key: str(payload.key ?? payload.name, node.id),
        varname: str(payload.varname ?? payload.var ?? "value", "value"),
        table: str(payload.table, "kv_store") || "kv_store",
      };
    case "db.set":
      return {
        ...base,
        key: str(payload.key ?? payload.name, node.id),
        table: str(payload.table, "kv_store") || "kv_store",
        values:
          payload.value !== undefined
            ? { value: payload.value }
            : asRecord(payload.values),
      };
    case "db.query":
      return {
        ...base,
        sql: str(payload.sql ?? payload.query, ""),
        varname: str(payload.varname ?? payload.var ?? "rows", "rows"),
      };
    case "db.insert":
      return {
        ...base,
        table: str(payload.table, "records"),
        values: asRecord(payload.values ?? payload.row ?? payload),
      };
    case "db.update":
      return {
        ...base,
        table: str(payload.table, "records"),
        where: str(payload.where ?? payload.condition, "1=1"),
        values: asRecord(payload.values ?? payload.set ?? payload),
      };
    default:
      return null;
  }
}

/** Build Visual DB IR from Bot IR graph nodes. */
export function extractVisualDbFromBotIR(botIr: {
  nodes: VisualDbBotNodeSource[];
}): VisualDbGraph {
  const nodes = botIr.nodes
    .map((n) => botIRNodeToVisualDb(n))
    .filter((n): n is VisualDbNode => n != null)
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    version: VISUAL_DB_IR_VERSION,
    nodes,
    nodeCount: nodes.length,
  };
}

/** Build Visual DB IR directly from Bot IR node array. */
export function buildVisualDbGraphFromBotNodes(
  nodes: VisualDbBotNodeSource[],
): VisualDbGraph {
  const dbNodes = nodes
    .map((n) => botIRNodeToVisualDb(n))
    .filter((n): n is VisualDbNode => n != null)
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    version: VISUAL_DB_IR_VERSION,
    nodes: dbNodes,
    nodeCount: dbNodes.length,
  };
}

export function hasVisualDbNodes(nodes: Array<{ type?: string }>): boolean {
  return nodes.some((n) => isDbNodeType(String(n?.type || "")));
}
