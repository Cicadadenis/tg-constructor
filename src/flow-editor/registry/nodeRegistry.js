/**
 * NodeRegistry — canonical React Flow node types for Cicada flow editor.
 */
import CicadaNode from '../../CicadaNode.jsx';

/** @type {import('@xyflow/react').NodeTypes} */
export const nodeTypes = Object.freeze({
  cicada: CicadaNode,
});

export const DEFAULT_NODE_TYPE = 'cicada';

/**
 * @param {string} blockType
 * @returns {string}
 */
export function resolveNodeType(blockType) {
  return DEFAULT_NODE_TYPE;
}
