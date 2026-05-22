export function generateCallbackHandler(node: any) {
  return `
@router.callback_query(
  F.data == "${node.data.callback}"
)
async def ${node.id}(callback):
    await callback.answer()
`;
}
