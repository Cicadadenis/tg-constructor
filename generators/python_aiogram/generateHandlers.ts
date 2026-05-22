export function generateMessageHandler(node: any) {
  return `
await message.answer(
  "${node.data.text || ""}"
)
`;
}
