import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from '@xyflow/react';

/**
 * Flow edge with hover "+" to insert a step (quick block picker).
 */
function FlowAddStepEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const [hovered, setHovered] = React.useState(false);
  const showAdd = hovered || data?.pickerOpen;
  const invalid = Boolean(data?.invalid);

  const onOpenPicker = (e) => {
    e.stopPropagation();
    e.preventDefault();
    data?.onOpenPicker?.(id, { x: e.clientX, y: e.clientY });
  };

  const edgeClass = [
    'flow-add-step-edge',
    hovered ? 'flow-add-step-edge--hover' : '',
    data?.pickerOpen ? 'flow-add-step-edge--active' : '',
    data?.executionPath ? 'flow-add-step-edge--execution' : '',
    invalid ? 'flow-add-step-edge--invalid' : '',
    selected ? 'selected' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <g
        className={edgeClass}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <path d={edgePath} className="flow-add-step-edge__hit" />
        <BaseEdge
          id={id}
          path={edgePath}
          className="flow-add-step-edge__path"
          style={invalid ? { strokeDasharray: '4 4' } : undefined}
        />
      </g>
      {showAdd && !invalid && (
        <EdgeLabelRenderer>
          <div
            className="flow-add-step-edge__btn-wrap nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
          >
            <button
              type="button"
              className="flow-add-step-edge__btn"
              title={data?.lang === 'en' ? 'Add step' : 'Добавить шаг'}
              aria-label={data?.lang === 'en' ? 'Add step' : 'Добавить шаг'}
              onClick={onOpenPicker}
              onPointerDown={(e) => e.stopPropagation()}
            >
              +
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default React.memo(FlowAddStepEdge);
