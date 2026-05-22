export function adaptVisualNode(node) {
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    data: {
      ...node.data,
    },
  };
}
