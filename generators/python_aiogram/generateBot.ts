export function generateAiogramBot(resolvedGraph: any[]) {
  const handlers = [];

  for (const node of resolvedGraph) {
    if (node.type === "command") {
      handlers.push(`
@router.message(Command("${node.data.command}"))
async def ${node.id}(message: Message):
    await message.answer("generated")
`);
    }
  }

  return `
from aiogram import Router
from aiogram.types import Message
from aiogram.filters import Command

router = Router()

${handlers.join("\n")}
`;
}
