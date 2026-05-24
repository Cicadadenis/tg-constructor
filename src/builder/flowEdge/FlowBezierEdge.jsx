import React, { useState } from 'react';
import { BaseEdge, getBezierPath } from '@xyflow/react';

/**
 * Visible smooth bezier connector between flow nodes.
 */
function FlowBezierEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
  style,
}) {
  const [hovered, setHovered] = useState(false);
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const className = [
    'flow-bezier-edge',
    hovered ? 'flow-bezier-edge--hover' : '',
    selected ? 'flow-bezier-edge--selected' : '',
    data?.executionPath ? 'flow-bezier-edge--execution' : '',
    data?.repairPath ? 'flow-bezier-edge--repair' : '',
    data?.invalid ? 'flow-bezier-edge--invalid' : '',
  ].filter(Boolean).join(' ');

  return (
    <g
      className={className}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <path d={edgePath} className="flow-bezier-edge__hit" />
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className="flow-bezier-edge__path"
        style={style}
      />
    </g>
  );
}

export default React.memo(FlowBezierEdge);
