import type { ExecutionGraph, ExecutionNode } from "./executionContract";

export const FSM_STATE_TYPE = "fsm.state" as const;
export const FSM_INPUT_TYPE = "fsm.input" as const;
export const FSM_TRANSITION_TYPE = "fsm.transition" as const;
export const LEGACY_FSM_TYPE = "fsm" as const;

export const FSM_NODE_TYPES = new Set<string>([
  FSM_STATE_TYPE,
  FSM_INPUT_TYPE,
  FSM_TRANSITION_TYPE,
  LEGACY_FSM_TYPE,
]);

export interface FsmStateNode {
  id: string;
  type: typeof FSM_STATE_TYPE;
  group: string;
  name: string;
  data: Record<string, unknown>;
}

export interface FsmInputNode {
  id: string;
  type: typeof FSM_INPUT_TYPE;
  group: string;
  field: string;
  prompt: string;
  data: Record<string, unknown>;
}

export interface FsmTransitionEdge {
  from: string;
  to: string;
  event?: string;
  condition?: string;
  viaNodeId?: string;
}

/** Graph-based FSM — states + inputs + transition edges (not StatesGroup classes). */
export interface FsmGraph {
  version: string;
  states: FsmStateNode[];
  inputs: FsmInputNode[];
  transitions: FsmTransitionEdge[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function isFsmNodeType(type: string): boolean {
  return FSM_NODE_TYPES.has(String(type || "").trim());
}

export function normalizeFsmNodeType(type: string): string {
  const t = String(type || "").trim();
  if (t === LEGACY_FSM_TYPE) return FSM_STATE_TYPE;
  return t;
}

function toPascalCase(value: string): string {
  return String(value || "State")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("") || "State";
}

function toFieldIdent(value: string): string {
  const raw = String(value || "step")
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, "_");
  return /^[a-zA-Z_]/.test(raw) ? raw : `_${raw}`;
}

function stateNodeFromExecution(node: ExecutionNode): FsmStateNode {
  const data = asRecord(node.data);
  const group = String(data.group ?? data.scenario ?? "Form").trim() || "Form";
  const name = String(
    data.name ?? data.state ?? data.step ?? node.id,
  ).trim();
  return {
    id: node.id,
    type: FSM_STATE_TYPE,
    group: toPascalCase(group),
    name: toFieldIdent(name),
    data,
  };
}

function inputNodeFromExecution(node: ExecutionNode): FsmInputNode {
  const data = asRecord(node.data);
  const group = String(data.group ?? data.scenario ?? "Form").trim() || "Form";
  const field = toFieldIdent(
    String(data.field ?? data.varname ?? data.name ?? node.id),
  );
  return {
    id: node.id,
    type: FSM_INPUT_TYPE,
    group: toPascalCase(group),
    field,
    prompt: String(data.prompt ?? data.question ?? data.text ?? ""),
    data,
  };
}

function transitionKey(t: FsmTransitionEdge): string {
  return `${t.from}\0${t.to}\0${t.event ?? ""}\0${t.condition ?? ""}`;
}

function addTransition(
  bucket: Map<string, FsmTransitionEdge>,
  transition: FsmTransitionEdge,
): void {
  const key = transitionKey(transition);
  if (!bucket.has(key)) bucket.set(key, transition);
}

/** Build graph-based FSM from a prepared ExecutionGraph. */
export function buildFsmGraph(execution: ExecutionGraph): FsmGraph {
  const nodeById = new Map(execution.nodes.map((n) => [n.id, n]));
  const states: FsmStateNode[] = [];
  const inputs: FsmInputNode[] = [];
  const transitionMap = new Map<string, FsmTransitionEdge>();

  for (const node of execution.nodes) {
    const norm = normalizeFsmNodeType(node.type);
    if (norm === FSM_STATE_TYPE) states.push(stateNodeFromExecution(node));
    else if (norm === FSM_INPUT_TYPE) inputs.push(inputNodeFromExecution(node));
  }

  for (const edge of execution.edges) {
    const source = nodeById.get(edge.from);
    const target = nodeById.get(edge.to);
    if (!source || !target) continue;

    const sourceType = normalizeFsmNodeType(source.type);
    const targetType = normalizeFsmNodeType(target.type);

    if (edge.trigger === "state" || isFsmNodeType(source.type) || isFsmNodeType(target.type)) {
      if (sourceType === FSM_TRANSITION_TYPE) continue;
      if (targetType === FSM_TRANSITION_TYPE) continue;

      addTransition(transitionMap, {
        from: edge.from,
        to: edge.to,
        event: edge.condition || undefined,
        condition: edge.condition,
      });
    }
  }

  for (const node of execution.nodes) {
    if (normalizeFsmNodeType(node.type) !== FSM_TRANSITION_TYPE) continue;
    const data = asRecord(node.data);
    const from = String(data.from ?? data.source ?? "").trim();
    const to = String(data.to ?? data.target ?? "").trim();
    if (from && to) {
      addTransition(transitionMap, {
        from,
        to,
        event: String(data.event ?? data.label ?? "").trim() || undefined,
        condition: String(data.condition ?? data.guard ?? "").trim() || undefined,
        viaNodeId: node.id,
      });
      continue;
    }

    const inEdges = execution.edges.filter((e) => e.to === node.id);
    const outEdges = execution.edges.filter((e) => e.from === node.id);
    for (const inn of inEdges) {
      for (const out of outEdges) {
        addTransition(transitionMap, {
          from: inn.from,
          to: out.to,
          event: String(data.event ?? data.label ?? "").trim() || undefined,
          condition: String(data.condition ?? data.guard ?? "").trim() || undefined,
          viaNodeId: node.id,
        });
      }
    }
  }

  const transitions = [...transitionMap.values()].sort((a, b) =>
    transitionKey(a).localeCompare(transitionKey(b)),
  );

  return {
    version: execution.version,
    states: states.sort((a, b) => a.id.localeCompare(b.id)),
    inputs: inputs.sort((a, b) => a.id.localeCompare(b.id)),
    transitions,
  };
}

/** Legacy flat transition list derived from the FSM graph. */
export function fsmTransitionsFromGraph(graph: FsmGraph): Array<{ from: string; to: string }> {
  return graph.transitions.map((t) => ({ from: t.from, to: t.to }));
}
