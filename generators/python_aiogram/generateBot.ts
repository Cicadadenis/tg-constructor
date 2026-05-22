import { generateMessageHandler } from "./generateHandlers";
import { generateCallbackHandler } from "./generateCallbacks";
import { generateFSMNode } from "./generateFSM";

export function generateAiogramBot(resolvedGraph: any[]) {
  const chunks = [];

  for (const node of resolvedGraph) {
    if (node.type === "command") {
      chunks.push(`
@router.message(Command("${node.data.command}"))
async def ${node.id}(message: Message):
    await message.answer("command")
`);
    }

    if (node.type === "message") {
      chunks.push(generateMessageHandler(node));
    }

    if (node.type === "callback") {
      chunks.push(generateCallbackHandler(node));
    }

    if (node.type === "fsm") {
      chunks.push(generateFSMNode(node));
    }
  }

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
`;
}
