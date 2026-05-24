/**
 * Aiogram AST extract JSON → Bot IR graph (nodes + edges).
 */

import { buildVisualDbGraphFromBotNodes } from "../db/visual_db_ir.js";
import { BOT_IR_VERSION, type BotIRGraph, type BotIREdge, type BotIRNode } from "../ir/bot_ir.js";
import { graphToBotIR } from "../ir/bot_ir.js";
import { getNodeCapabilities } from "../blockRegistry.js";
import { getNodePortDescriptors } from "../../src/constructor/graph_document/operation_registry.js";
import { botIRToGraphDocument } from "../templates/botIrToGraphDocument.js";
import type { GraphDocumentInput } from "../ir/bot_ir.js";

export interface AiogramExtractAction {
  type: string;
  text?: string;
  state?: string;
  target?: string;
  expr?: string;
}

export interface AiogramExtractHandler {
  name: string;
  file: string;
  line: number;
  channel: string;
  kind: string;
  filters: Record<string, unknown>[];
  payload: Record<string, unknown>;
  actions: AiogramExtractAction[];
  async?: boolean;
}

export interface AiogramFsmState {
  name: string;
  line?: number;
}

export interface AiogramFsmGroup {
  name: string;
  line?: number;
  states: AiogramFsmState[];
}

export interface AiogramExtractResult {
  ok: boolean;
  error?: string;
  files?: string[];
  handlers?: AiogramExtractHandler[];
  fsm?: { groups: AiogramFsmGroup[] };
  botToken?: string | null;
}

function slug(value: string): string {
  return String(value || "node")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "node";
}

function mapPorts(type: string) {
  const { inputs, outputs } = getNodePortDescriptors(type);
  const map = (ports: readonly { id: string; kind?: string; label?: string }[]) =>
    ports.map((p) => ({
      id: String(p.id),
      ...(p.kind != null ? { kind: String(p.kind) } : {}),
      ...(p.label != null ? { label: String(p.label) } : {}),
    }));
  return {
    inputs: Object.freeze(map(inputs)),
    outputs: Object.freeze(map(outputs)),
  };
}

function makeNode(
  id: string,
  type: string,
  payload: Record<string, unknown>,
  layoutIndex: number,
): BotIRNode {
  const ports = mapPorts(type);
  return {
    id,
    type,
    inputs: ports.inputs,
    outputs: ports.outputs,
    capabilities: Object.freeze({ ...getNodeCapabilities(type) }),
    payload: Object.freeze({ ...payload }),
  };
}

function makeEdge(id: string, source: string, target: string): BotIREdge {
  return {
    id,
    source,
    target,
    sourcePort: "flow",
    targetPort: "flow",
  };
}

function resolveHandlerBlockType(kind: string): string {
  if (kind === "start") return "start";
  if (kind === "command") return "command";
  if (kind === "callback") return "callback";
  return "on_message";
}

function stripQuotes(value: string): string {
  const t = value.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

/**
 * Build Bot IR from Python AST extract payload.
 */
export function aiogramExtractToBotIR(extract: AiogramExtractResult): BotIRGraph {
  const nodes: BotIRNode[] = [];
  const edges: BotIREdge[] = [];
  const positions: Record<string, { x: number; y: number }> = {};
  let layout = 0;

  const place = (id: string) => {
    const col = layout % 3;
    const row = Math.floor(layout / 3);
    positions[id] = { x: col * 280, y: row * 140 };
    layout += 1;
  };

  if (extract.botToken) {
    const id = "bot_imported";
    nodes.push(makeNode(id, "bot", { token: extract.botToken }, layout));
    place(id);
  }

  const fsmGroups = extract.fsm?.groups || [];
  const stateIdByKey = new Map<string, string>();

  for (const group of fsmGroups) {
    for (const st of group.states || []) {
      const id = `fsm_${slug(group.name)}_${slug(st.name)}`;
      stateIdByKey.set(`${group.name}.${st.name}`, id);
      nodes.push(
        makeNode(id, "fsm.state", {
          group: group.name,
          name: st.name,
          importedFrom: "python",
        }, layout),
      );
      place(id);
    }
  }

  const handlers = extract.handlers || [];
  for (let hi = 0; hi < handlers.length; hi += 1) {
    const h = handlers[hi];
    const blockType = resolveHandlerBlockType(h.kind);
    const handlerId = `h_${slug(h.name)}_${hi}`;
    const handlerPayload: Record<string, unknown> = {
      ...h.payload,
      handlerName: h.name,
      sourceFile: h.file,
      sourceLine: h.line,
      importedFrom: "python",
    };
    if (blockType === "command" && !handlerPayload.cmd) {
      handlerPayload.cmd = h.name.replace(/^cmd_/, "").replace(/^handle_/, "");
    }

    nodes.push(makeNode(handlerId, blockType, handlerPayload, layout));
    place(handlerId);

    let prevId = handlerId;
    const actions = h.actions || [];
    for (let ai = 0; ai < actions.length; ai += 1) {
      const act = actions[ai];
      if (act.type === "set_state" && act.state) {
        const key = act.state.split("(")[0]?.trim() || act.state;
        const stateNodeId = stateIdByKey.get(key) || stateIdByKey.get(key.split(".").slice(-2).join("."));
        if (stateNodeId) {
          edges.push(makeEdge(`e_${slug(prevId)}_fsm_${ai}`, prevId, stateNodeId));
          prevId = stateNodeId;
        }
        continue;
      }
      if (act.type === "clear_state") {
        continue;
      }
      if (act.type === "answer" || act.type === "edit_text") {
        const msgId = `msg_${slug(h.name)}_${ai}`;
        nodes.push(
          makeNode(msgId, "message", {
            text: stripQuotes(act.text || ""),
            importedFrom: "python",
            ...(act.type === "edit_text" ? { edit: true } : {}),
          }, layout),
        );
        place(msgId);
        edges.push(makeEdge(`e_${slug(prevId)}_${msgId}`, prevId, msgId));
        prevId = msgId;
      }
    }
  }

  const ir: BotIRGraph = {
    version: BOT_IR_VERSION,
    nodes,
    edges,
    visualDb: buildVisualDbGraphFromBotNodes(nodes),
    context: {
      schemaVersion: 2,
      viewport: { x: 0, y: 0, zoom: 1 },
      metadata: {
        importedFrom: "aiogram3_python",
        importSourceFiles: extract.files || [],
        handlerCount: handlers.length,
        fsmGroupCount: fsmGroups.length,
        nodePositions: positions,
      },
      nodeCount: nodes.length,
      edgeCount: edges.length,
    },
  };

  return ir;
}

/**
 * Full pipeline: extract JSON → Bot IR → GraphDocument input.
 */
export function aiogramExtractToGraphDocument(
  extract: AiogramExtractResult,
): GraphDocumentInput {
  const ir = aiogramExtractToBotIR(extract);
  return botIRToGraphDocument(ir);
}

/** Round-trip sanity: extract → IR → graph → IR preserves node count. */
export function verifyImportRoundTrip(extract: AiogramExtractResult): {
  ir: BotIRGraph;
  graph: GraphDocumentInput;
  roundIr: BotIRGraph;
} {
  const ir = aiogramExtractToBotIR(extract);
  const graph = botIRToGraphDocument(ir);
  const roundIr = graphToBotIR(graph);
  return { ir, graph, roundIr };
}
