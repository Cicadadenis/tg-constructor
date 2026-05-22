import type { ExecutionGraph } from "../../core/execution/executionContract";
import {
  getNextTargets,
  getOutgoingEdges,
} from "../../core/execution/executionContract";
import { generateMessageHandler } from "./generateHandlers";
import { generateCallbackHandler } from "./generateCallbacks";
import { generateFSMNode } from "./generateFSM";

function formatEdgeComment(edge: {
  to: string;
  trigger: string;
  condition?: string;
}): string {
  const cond = edge.condition ? ` condition=${edge.condition}` : "";
  return `# -> ${edge.to} [${edge.trigger}${cond}]`;
}

export function generateAiogramBot(execution: ExecutionGraph): string {
  const chunks: string[] = [];

  for (const node of execution.nodes) {
    const outgoing = getOutgoingEdges(execution, node.id);
    const edgeComments = outgoing.map(formatEdgeComment).join("\n");
    const nextTargets = getNextTargets(execution, node.id);

    if (node.type === "command") {
      const command = String(node.data?.command ?? "start");
      chunks.push(`
@router.message(Command("${command}"))
async def ${node.id}(message: Message):
    await message.answer("command: ${command}")
${edgeComments ? `    ${edgeComments.split("\n").join("\n    ")}` : ""}
    # next: ${nextTargets.join(", ") || "(none)"}
`);
    }

    if (node.type === "message") {
      chunks.push(generateMessageHandler({ id: node.id, data: node.data }));
      if (edgeComments) chunks.push(edgeComments);
    }

    if (node.type === "callback") {
      chunks.push(
        generateCallbackHandler({
          id: node.id,
          data: { callback: String(node.data?.callback ?? node.data?.data ?? "") },
        }),
      );
      if (edgeComments) chunks.push(edgeComments);
    }

    if (node.type === "fsm") {
      chunks.push(generateFSMNode({ id: node.id, data: node.data }));
      const stateEdges = outgoing.filter((e) => e.trigger === "state");
      for (const edge of stateEdges) {
        chunks.push(`# state ${edge.from} -> ${edge.to}${edge.condition ? ` (${edge.condition})` : ""}`);
      }
    }
  }

  const edgeManifest = execution.edges
    .map(
      (e) =>
        `# EDGE ${e.from} -> ${e.to} [${e.trigger}${e.condition ? `:${e.condition}` : ""}]`,
    )
    .join("\n");

  return `
from aiogram import Router, F
from aiogram.types import Message
from aiogram.filters import Command

from aiogram.fsm.state import (
  State,
  StatesGroup
)

router = Router()

${chunks.join("\n")}

# --- execution graph (source of truth) ---
${edgeManifest || "# (no edges)"}
`;
}
