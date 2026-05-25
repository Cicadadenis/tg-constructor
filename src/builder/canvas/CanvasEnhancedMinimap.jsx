import React, { useCallback } from 'react';
import { MiniMap } from '@xyflow/react';
import { VISUAL_NODE_SPECS } from '../visualNodes/visualNodeTypes.js';
import { resolveVisualType } from '../visualNodes/runtimeToVisual.js';

/**
 * Minimap with visual-type colors (ManyChat-style overview).
 */
export default function CanvasEnhancedMinimap({ lang = 'ru' }) {
  const nodeColor = useCallback((node) => {
    if (node.data?.executionPath) return 'var(--color-primary)';
    if (node.data?.repairPulse) return 'var(--color-success)';
    const visualType = node.data?.visualType
      || resolveVisualType(node.data?.runtimeType || node.data?.canvasBlockType);
    return VISUAL_NODE_SPECS[visualType]?.accent || '#2563eb';
  }, []);

  const nodeClassName = useCallback((node) => {
    const parts = ['canvas-minimap__node'];
    if (node.selected) parts.push('canvas-minimap__node--selected');
    return parts.join(' ');
  }, []);

  return (
    <MiniMap
      className="canvas-minimap canvas-minimap--enhanced"
      position="bottom-right"
      nodeColor={nodeColor}
      nodeClassName={nodeClassName}
      nodeStrokeWidth={0}
      nodeBorderRadius={4}
      maskColor="rgba(15, 23, 42, 0.06)"
      maskStrokeColor="rgba(37, 99, 235, 0.35)"
      maskStrokeWidth={2}
      pannable
      zoomable
      ariaLabel={lang === 'en' ? 'Canvas minimap' : 'Миникарта холста'}
    />
  );
}
