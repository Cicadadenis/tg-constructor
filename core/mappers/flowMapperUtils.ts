/**
 * React Flow → compiler boundary helpers (geometry, edge keys).
 */

/** Minimal React Flow node shape accepted by reactFlowToGraph. */
export interface FlowNodeInput {
  id: string;
  type?: string;
  position?: { x?: unknown; y?: unknown };
  data?: Record<string, unknown>;
}

/** Minimal React Flow edge shape accepted by reactFlowToGraph. */
export interface FlowEdgeInput {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

const DEFAULT_POSITION = { x: 0, y: 0 };

/**
 * Coerce node position to finite numbers (NaN/Infinity → 0).
 */
export function sanitizeFlowPosition(
  position?: { x?: unknown; y?: unknown },
): { x: number; y: number } {
  const x = Number(position?.x);
  const y = Number(position?.y);
  return {
    x: Number.isFinite(x) ? x : DEFAULT_POSITION.x,
    y: Number.isFinite(y) ? y : DEFAULT_POSITION.y,
  };
}

/**
 * Stable edge id including handles when multiple edges share source→target.
 */
export function buildCanonicalFlowEdgeId(edge: FlowEdgeInput): string {
  if (edge.id && String(edge.id).trim()) {
    return String(edge.id).trim();
  }
  const src = String(edge.source);
  const tgt = String(edge.target);
  const sh = edge.sourceHandle != null && edge.sourceHandle !== ""
    ? String(edge.sourceHandle)
    : "flow";
  const th = edge.targetHandle != null && edge.targetHandle !== ""
    ? String(edge.targetHandle)
    : "flow";
  return `${src}|${sh}->${tgt}|${th}`;
}
