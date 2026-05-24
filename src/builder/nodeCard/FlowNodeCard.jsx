import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { BuilderUiContext } from '../../builderContext.js';
import { getBlockDef } from '../../constructor/block_catalog.js';
import { graphResolveNodeType } from '../../app/graph/graphHelpers.js';
import { getBlockDefinition } from '../../../core/blockRegistry.js';
import { getNodePortDescriptors } from '../../constructor/graph_document/operation_registry.js';
import { useGraphCanvasActions } from '../graphCanvasActionsContext.jsx';
import { getNodeCardContent } from './nodeCardContent.js';
import { getFlowNodeCardLayout, NODE_CARD_WIDTH } from './nodeCardLayout.js';
import './flow-node-card.css';

/**
 * @param {string} nodeType
 */
function resolveOutputPorts(nodeType) {
  const desc = getNodePortDescriptors(nodeType);
  const outs = desc.outputs || [];
  if (!outs.length) return [];
  return outs.map((p) => ({
    id: p.id || 'flow',
    label: p.edgeLabel || p.label || null,
  }));
}

function FlowNodeCard({ id, data, selected }) {
  const ctx = React.useContext(BuilderUiContext);
  const actions = useGraphCanvasActions();
  const blockTypes = ctx?.blockTypes;
  const lang = ctx?.lang || 'ru';

  const type = graphResolveNodeType({
    type: data?.canvasBlockType,
    data: data?.props ?? {},
  });
  const def = getBlockDef(type, blockTypes);
  const registryDef = getBlockDefinition(type);
  const icon = def?.icon || '◆';
  const label = data?.label || def?.label || type;
  const nodeId = id || data?.graphDocumentNodeId;
  const isChainRoot = Boolean(data?.isChainRoot);
  const snapHint = data?.snapHint || null;

  const content = getNodeCardContent(type, data?.props, data?.meta, {
    label,
    description: registryDef?.description,
    category: registryDef?.category,
    isChainRoot,
    lang,
  });

  const outputPorts = resolveOutputPorts(type);
  const layout = getFlowNodeCardLayout({
    type,
    isChainRoot,
    bodyLineCount: content.bodyLineCount,
    canStack: def?.canStack !== false,
    outputPorts,
  });

  const [hovered, setHovered] = React.useState(false);
  const showActions = hovered || selected;

  const stopBubble = (e) => {
    e.stopPropagation();
  };

  const onHitPointerDown = (e) => {
    if (e.button !== 0) return;
    actions?.onSelectNode?.(nodeId);
  };

  const categoryClass = `flow-node-card--${content.productCategory}`;
  const snapClass = snapHint === 'ok' ? ' snap-ok' : snapHint === 'bad' ? ' snap-bad' : '';

  const inputPort = (getNodePortDescriptors(type).inputs || [])[0];
  const hasInput = layout.hasTopSocket && inputPort;

  return (
    <div
      className={`flow-node-card ${categoryClass}${selected ? ' selected' : ''}${showActions ? ' show-actions' : ''}${snapClass}`}
      style={{
        width: layout.outerWidth,
        height: layout.outerHeight,
        padding: `${layout.contentOffsetY}px ${layout.contentOffsetX}px`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="flow-node-card-hit cicada-node-hit"
        role="button"
        tabIndex={0}
        aria-label={label}
        onPointerDown={onHitPointerDown}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          cursor: 'grab',
          borderRadius: 'var(--radius-md)',
        }}
      />

      <div
        className="flow-node-card__surface"
        style={{ minHeight: layout.height }}
      >
        <header className="flow-node-card__header">
          <div className="flow-node-card__icon" aria-hidden>{icon}</div>
          <div className="flow-node-card__head-text">
            <div className="flow-node-card__category">{content.categoryLabel}</div>
            <div className="flow-node-card__title" title={label}>{label}</div>
          </div>
        </header>

        <section className="flow-node-card__preview" style={{ minHeight: layout.bodyH }}>
          <div className="flow-node-card__preview-label">{content.previewTitle}</div>
          <div
            className="flow-node-card__preview-body"
            style={{ WebkitLineClamp: Math.min(4, content.bodyLineCount + 1) }}
            title={content.previewBody}
          >
            {content.previewBody}
          </div>
        </section>

        <footer className="flow-node-card__meta">
          {content.tags.map((tag, i) => (
            <span
              key={tag}
              className={`flow-node-card__tag${i === 0 ? ' flow-node-card__tag--accent' : ''}`}
            >
              {tag}
            </span>
          ))}
          {content.status && (
            <span className="flow-node-card__status">{content.status}</span>
          )}
        </footer>
      </div>

      <div
        className="flow-node-card__actions"
        onPointerDown={stopBubble}
      >
        {actions?.onAddAfterNode && (
          <button
            type="button"
            className="flow-node-card__action-btn"
            title={lang === 'en' ? 'Add next' : 'Добавить след.'}
            onClick={(e) => {
              e.stopPropagation();
              actions.onAddAfterNode(nodeId);
            }}
          >
            +
          </button>
        )}
        {actions?.onDuplicateNode && (
          <button
            type="button"
            className="flow-node-card__action-btn"
            title={lang === 'en' ? 'Duplicate' : 'Дублировать'}
            onClick={(e) => {
              e.stopPropagation();
              actions.onDuplicateNode(nodeId);
            }}
          >
            ⎘
          </button>
        )}
        {actions?.onDeleteNode && (
          <button
            type="button"
            className="flow-node-card__action-btn flow-node-card__action-btn--danger"
            title={lang === 'en' ? 'Delete' : 'Удалить'}
            onClick={(e) => {
              e.stopPropagation();
              actions.onDeleteNode(nodeId);
            }}
          >
            ✕
          </button>
        )}
      </div>

      {hasInput && (
        <Handle
          type="target"
          position={Position.Top}
          id={inputPort.id}
          className="flow-node-card__handle"
          style={{
            top: layout.contentOffsetY - 4,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        />
      )}

      {outputPorts.length <= 1 ? (
        outputPorts.length === 1 && (
          <Handle
            type="source"
            position={Position.Bottom}
            id={outputPorts[0].id}
            className="flow-node-card__handle"
            style={{
              bottom: layout.contentOffsetY - 4,
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          />
        )
      ) : (
        outputPorts.map((port, index) => {
          const pct = ((index + 1) / (outputPorts.length + 1)) * 100;
          return (
            <React.Fragment key={port.id}>
              <Handle
                type="source"
                position={Position.Bottom}
                id={port.id}
                className="flow-node-card__handle"
                style={{
                  bottom: layout.contentOffsetY - 4,
                  left: `${pct}%`,
                  transform: 'translateX(-50%)',
                }}
              />
              {port.label && (
                <span
                  className="flow-node-card__handle-label"
                  style={{
                    bottom: layout.contentOffsetY - 18,
                    left: `${pct}%`,
                  }}
                >
                  {port.label}
                </span>
              )}
            </React.Fragment>
          );
        })
      )}
    </div>
  );
}

function flowNodeCardPropsAreEqual(prev, next) {
  if (prev.selected !== next.selected) return false;
  if (prev.id !== next.id) return false;
  const pd = prev.data || {};
  const nd = next.data || {};
  if (pd.canvasBlockType !== nd.canvasBlockType) return false;
  if (pd.previewEpoch !== nd.previewEpoch) return false;
  if (pd.repairPulse !== nd.repairPulse) return false;
  if (pd.executionPath !== nd.executionPath) return false;
  if (pd.snapHint !== nd.snapHint) return false;
  if (pd.isChainRoot !== nd.isChainRoot) return false;
  if (pd.label !== nd.label) return false;
  if (JSON.stringify(pd.props) !== JSON.stringify(nd.props)) return false;
  if (JSON.stringify(pd.meta) !== JSON.stringify(nd.meta)) return false;
  return true;
}

export default React.memo(FlowNodeCard, flowNodeCardPropsAreEqual);
export { NODE_CARD_WIDTH };
