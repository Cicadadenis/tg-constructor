import { getSmoothStepPath, getBezierPath } from '@xyflow/react';
import {
  CANVAS_EDGE_BORDER_RADIUS,
  CANVAS_EDGE_OFFSET,
} from './canvasInteractionConfig.js';

/**
 * n8n-style smooth step routing with rounded corners.
 * @param {import('@xyflow/react').EdgeProps} props
 */
export function getFlowEdgePath(props) {
  return getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
    borderRadius: CANVAS_EDGE_BORDER_RADIUS,
    offset: CANVAS_EDGE_OFFSET,
  });
}

/**
 * @param {import('@xyflow/react').EdgeProps} props
 */
export function getFlowBezierPath(props) {
  return getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  });
}
