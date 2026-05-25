/**
 * Canvas node type — product-grade flow card (legacy export name "cicada").
 */
import { getNodePortDescriptors } from './constructor/graph_document/operation_registry.js';

export function getPortType(type) {
  const desc = getNodePortDescriptors(type);
  const hasInput = (desc.inputs || []).length > 0;
  const hasOutput = (desc.outputs || []).length > 0;
  const input = hasInput ? (desc.inputs[0]?.id || 'flow') : null;
  const output = hasOutput ? (desc.outputs[0]?.id || 'flow') : null;
  return { input, output };
}

export { default } from './builder/visualNodes/VisualNodeCard.jsx';
export { NODE_CARD_WIDTH } from './builder/visualNodes/visualNodeLayout.js';
