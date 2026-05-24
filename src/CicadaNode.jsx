import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { BuilderUiContext } from './builderContext.js';
import { getBlockDef } from './constructor/block_catalog.js';
import { getPreview } from './builder/blockPreview.js';
import {
  BLOCK_W,
  TAB_OVERLAP,
  puzzlePath,
  darken,
} from './builder/blockLayout.js';
import { getCicadaNodeLayout } from './builder/graph_canvas_metrics.js';
import { getNodePortDescriptors } from './constructor/graph_document/operation_registry.js';
import { useGraphCanvasActions } from './builder/graphCanvasActionsContext.jsx';

export function getPortType(type) {
  const desc = getNodePortDescriptors(type);
  const hasInput = (desc.inputs || []).length > 0;
  const hasOutput = (desc.outputs || []).length > 0;
  const input = hasInput ? (desc.inputs[0]?.id || 'flow') : null;
  const output = hasOutput ? (desc.outputs[0]?.id || 'flow') : null;
  return { input, output };
}

const CTRL_BTN = {
  width: 22,
  height: 22,
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(15,12,32,0.92)',
  color: 'rgba(255,255,255,0.9)',
  fontSize: 11,
  lineHeight: 1,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
};

function CicadaNode({ id, data, selected }) {
  const ctx = React.useContext(BuilderUiContext);
  const actions = useGraphCanvasActions();
  const blockTypes = ctx?.blockTypes;
  const type = data?.type || 'message';
  const def = getBlockDef(type, blockTypes);
  const color = def?.color || '#5b7cf6';
  const icon = def?.icon || '◆';
  const label = data?.label || def?.label || type;
  const nodeData = data?.props || data;
  const preview = getPreview(type, nodeData, data?.meta);
  const isChainRoot = Boolean(data?.isChainRoot);
  const canStack = def?.canStack !== false;
  const isKeyboardNode = type === 'inline_keyboard' || type === 'reply_keyboard';
  const kbLineCount = isKeyboardNode && preview
    ? preview.split('\n').filter(Boolean).length
    : 1;
  const extraKbH = isKeyboardNode ? Math.max(0, kbLineCount - 1) * 14 : 0;
  const layout = getCicadaNodeLayout(type, isChainRoot, canStack, extraKbH);
  const { hasTopSocket, hasBottomTab, bodyH, contentOffsetX, contentOffsetY } = layout;
  const h = bodyH;
  const path = puzzlePath(BLOCK_W, h, hasTopSocket, hasBottomTab);
  const dark = darken(color, 45);
  const portType = getPortType(type);
  const snapHint = data?.snapHint || null;
  const nodeId = id || data?.graphDocumentNodeId;

  const [hovered, setHovered] = React.useState(false);
  const showChrome = hovered || selected;

  const hStyle = {
    background: 'transparent',
    border: 'none',
    width: 18,
    height: 18,
    opacity: 0,
    pointerEvents: 'all',
    cursor: 'crosshair',
    zIndex: 4,
  };

  const stopNodeBubble = (e) => {
    e.stopPropagation();
  };

  const onDeleteClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    actions?.onDeleteNode?.(nodeId);
  };

  const onHitPointerDown = (e) => {
    if (e.button !== 0) return;
    actions?.onSelectNode?.(nodeId);
  };

  return (
    <div
      className="cicada-node-root"
      style={{
        position: 'relative',
        width: layout.outerWidth,
        height: layout.outerHeight,
        marginBottom: hasBottomTab ? -TAB_OVERLAP : 0,
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <div
        className="cicada-node-hit"
        role="button"
        tabIndex={0}
        aria-label={label}
        onPointerDown={onHitPointerDown}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          borderRadius: 10,
          boxShadow: showChrome
            ? `0 0 0 2px ${selected ? 'rgba(255,255,255,0.55)' : `${color}66`}, 0 0 ${selected ? 22 : 14}px ${color}${selected ? '55' : '33'}`
            : (selected ? `0 0 0 2px rgba(255,255,255,0.4)` : 'none'),
          transition: 'box-shadow 0.15s ease',
        }}
      />

      <svg
        width={BLOCK_W + 24}
        height={h + 24}
        viewBox={`-4 -8 ${BLOCK_W + 16} ${h + 16}`}
        style={{
          position: 'absolute',
          top: contentOffsetY,
          left: contentOffsetX,
          overflow: 'visible',
          pointerEvents: 'none',
          zIndex: 2,
          filter: selected
            ? `drop-shadow(0 0 7px ${color}cc) drop-shadow(0 2px 10px rgba(0,0,0,.8))`
            : 'drop-shadow(0 2px 7px rgba(0,0,0,.65))',
        }}
      >
        <path d={path} fill="rgba(0,0,0,0.35)" transform="translate(0,3)" />
        <path d={path} fill={color} />
        <clipPath id={`hc-${type}-${nodeId}-${selected ? 1 : 0}`}>
          <rect x="0" y="0" width={BLOCK_W} height={h} />
        </clipPath>
        <path d={path} fill={dark} clipPath={`url(#hc-${type}-${nodeId}-${selected ? 1 : 0})`} opacity="0.45" />
        <path d={path} fill="rgba(255,255,255,0.12)" />
        <path d={path} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" />
        <path d={path} fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="1" transform="translate(0,1)" />
        {selected && <path d={path} fill="none" stroke="white" strokeWidth="2" opacity="0.85" />}
        {snapHint === 'ok' && <path d={path} fill="none" stroke="#3ecf8e" strokeWidth="2.2" opacity="0.95" />}
        {snapHint === 'bad' && <path d={path} fill="none" stroke="#f87171" strokeWidth="2.2" opacity="0.95" />}
      </svg>

      {portType.input && (
        <Handle
          type="target"
          position={Position.Top}
          id={portType.input}
          style={{
            ...hStyle,
            top: contentOffsetY - 6,
            left: contentOffsetX + BLOCK_W / 2,
            transform: 'translateX(-50%)',
          }}
        />
      )}
      {portType.output && (
        <Handle
          type="source"
          position={Position.Bottom}
          id={portType.output}
          style={{
            ...hStyle,
            bottom: (hasBottomTab ? TAB_OVERLAP : 0) + contentOffsetY - 6,
            left: contentOffsetX + BLOCK_W / 2,
            transform: 'translateX(-50%)',
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          top: contentOffsetY,
          left: contentOffsetX,
          width: BLOCK_W,
          height: h,
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px 0 10px',
          gap: 6,
          zIndex: 3,
          pointerEvents: 'none',
        }}
      >
        <span style={{ fontSize: isChainRoot ? 14 : 12, flexShrink: 0, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.5))' }}>
          {icon}
        </span>
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          <div
            style={{
              fontSize: isChainRoot ? 11 : 10,
              fontWeight: 700,
              color: '#fff',
              fontFamily: 'Syne, system-ui',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textShadow: '0 1px 3px rgba(0,0,0,.7)',
            }}
          >
            {label}
          </div>
          {preview && (
            <div
              style={{
                fontSize: 9,
                color: 'rgba(255,255,255,0.78)',
                fontFamily: 'JetBrains Mono, monospace',
                whiteSpace: isKeyboardNode ? 'pre-line' : 'nowrap',
                overflow: 'hidden',
                textOverflow: isKeyboardNode ? 'clip' : 'ellipsis',
                marginTop: 1,
                lineHeight: 1.35,
                maxHeight: isKeyboardNode ? extraKbH + 28 : undefined,
              }}
            >
              {preview}
            </div>
          )}
        </div>
      </div>

      <div
        className="cicada-node-controls"
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          zIndex: 5,
          display: 'flex',
          gap: 4,
          opacity: showChrome ? 1 : 0,
          transform: showChrome ? 'translateY(0)' : 'translateY(-4px)',
          transition: 'opacity 0.12s ease, transform 0.12s ease',
          pointerEvents: showChrome ? 'all' : 'none',
        }}
        onPointerDown={stopNodeBubble}
      >
        {actions?.onDeleteNode && (
          <button
            type="button"
            title="Удалить"
            style={{
              ...CTRL_BTN,
              color: '#fecaca',
              borderColor: 'rgba(248,113,113,0.45)',
              background: 'rgba(127,29,29,0.85)',
            }}
            onClick={onDeleteClick}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function cicadaNodePropsAreEqual(prev, next) {
  if (prev.selected !== next.selected) return false;
  if (prev.id !== next.id) return false;
  const pd = prev.data || {};
  const nd = next.data || {};
  if (pd.type !== nd.type) return false;
  if (pd.previewEpoch !== nd.previewEpoch) return false;
  if (pd.snapHint !== nd.snapHint) return false;
  if (pd.repairPulse !== nd.repairPulse) return false;
  if (pd.isChainRoot !== nd.isChainRoot) return false;
  if (pd.label !== nd.label) return false;
  return true;
}

export default React.memo(CicadaNode, cicadaNodePropsAreEqual);
