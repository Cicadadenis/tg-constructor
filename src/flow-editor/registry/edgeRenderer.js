/**
 * EdgeRenderer — React Flow edge components (smart paths, inline insert).
 */
import FlowAddStepEdge from '../../builder/flowEdge/FlowAddStepEdge.jsx';
import FlowBezierEdge from '../../builder/flowEdge/FlowBezierEdge.jsx';

/** @type {import('@xyflow/react').EdgeTypes} */
export const edgeTypes = Object.freeze({
  flowAdd: FlowAddStepEdge,
  flowBezier: FlowBezierEdge,
});

export const DEFAULT_EDGE_TYPE = 'flowBezier';

export const edgeDefaults = Object.freeze({
  type: DEFAULT_EDGE_TYPE,
  style: { stroke: 'var(--fe-edge-stroke, #94a3b8)', strokeWidth: 1.5 },
  animated: false,
});
