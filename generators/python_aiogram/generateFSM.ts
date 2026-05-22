export function generateFSMNode(node: any) {
  return `
class ${node.id}States(
  StatesGroup
):
    step = State()
`;
}
