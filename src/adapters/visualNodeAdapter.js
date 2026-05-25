import { resolveVisualType } from '../builder/visualNodes/runtimeToVisual.js';

/**
 * Adapts a GraphDocument node for React Flow projection (runtime type preserved).
 * @param {{ id: string, type: string, position: object, data?: object, meta?: object }} node
 */
export function adaptVisualNode(node) {
  const runtimeType = node.type;
  const visualType = resolveVisualType(runtimeType);
  return {
    id: node.id,
    type: 'cicada',
    position: node.position,
    data: {
      canvasBlockType: runtimeType,
      runtimeType,
      visualType,
      props: { ...(node.data || {}) },
      meta: { ...(node.meta || {}) },
      graphDocumentNodeId: node.id,
    },
  };
}
