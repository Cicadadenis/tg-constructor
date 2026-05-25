import React, { useCallback, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { tierAllowsMotion, tierAllowsRichPreview } from '../../performance/zoomTier.js';
import { BuilderUiContext } from '../../builderContext.js';
import { getBlockDef } from '../../constructor/block_catalog.js';
import { graphResolveNodeType } from '../../app/graph/graphHelpers.js';
import { getBlockDefinition } from '../../../core/blockRegistry.js';
import { useGraphCanvasActions } from '../graphCanvasActionsContext.jsx';
import { resolveVisualEditorNode } from './resolveVisualNode.js';
import { getVisualNodeLayout } from './visualNodeLayout.js';
import './visual-node-card.css';

const surfaceMotion = {
  rest: { scale: 1 },
  hover: { scale: 1.015 },
  selected: { scale: 1.02 },
};

/**
 * ManyChat-style visual editor node.
 * Renders from runtime GraphDocument type; compiler sees only runtimeType.
 */
function VisualNodeCard({ id, data, selected }) {
  const ctx = React.useContext(BuilderUiContext);
  const actions = useGraphCanvasActions();
  const blockTypes = ctx?.blockTypes;
  const lang = ctx?.lang || 'ru';

  const runtimeType = graphResolveNodeType({
    type: data?.canvasBlockType,
    data: data?.props ?? {},
  });
  const def = getBlockDef(runtimeType, blockTypes);
  const registryDef = getBlockDefinition(runtimeType);
  const nodeId = id || data?.graphDocumentNodeId;
  const isChainRoot = Boolean(data?.isChainRoot);
  const snapHint = data?.snapHint || null;

  const visual = resolveVisualEditorNode({
    runtimeType,
    props: data?.props,
    meta: data?.meta,
    label: data?.label,
    paletteIcon: def?.icon,
    paletteLabel: def?.label || data?.label,
    description: registryDef?.description,
    isChainRoot,
    lang,
  });

  const layout = getVisualNodeLayout({
    isChainRoot,
    bodyLineCount: visual.content.bodyLineCount,
    outputPorts: visual.outputPorts,
  });

  const [hovered, setHovered] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [draft, setDraft] = useState('');
  const showActions = hovered || selected;

  const stopBubble = (e) => e.stopPropagation();

  const onHitPointerDown = (e) => {
    if (e.button !== 0 || editingField) return;
    actions?.onSelectNode?.(nodeId);
  };

  const startInlineEdit = (e) => {
    const spec = visual.content.inlineEdit;
    if (!spec || !actions?.onInlineEdit) return;
    e.stopPropagation();
    const current = data?.props?.[spec.field];
    setDraft(current != null ? String(current) : '');
    setEditingField(spec.field);
  };

  const commitInlineEdit = useCallback(() => {
    if (!editingField || !actions?.onInlineEdit) {
      setEditingField(null);
      return;
    }
    actions.onInlineEdit(nodeId, editingField, draft);
    setEditingField(null);
  }, [editingField, draft, actions, nodeId]);

  const snapClass = snapHint === 'ok' ? ' snap-ok' : snapHint === 'bad' ? ' snap-bad' : '';
  const motionState = selected ? 'selected' : hovered ? 'hover' : 'rest';
  const lazyRender = Boolean(data?.lazyRender);
  const zoomTier = data?.zoomTier || 'full';
  const richPreview = tierAllowsRichPreview(zoomTier) && !lazyRender;
  const useMotion = tierAllowsMotion(zoomTier) && !lazyRender;
  const Surface = useMotion ? motion.div : 'div';
  const surfaceProps = useMotion
    ? {
      variants: surfaceMotion,
      initial: 'rest',
      animate: motionState,
      transition: { type: 'spring', stiffness: 420, damping: 32 },
    }
    : {};

  return (
    <div
      className={`visual-node-card visual-node-card--${visual.visualType}${selected ? ' selected' : ''}${showActions ? ' show-actions' : ''}${snapClass}`}
      style={{
        width: layout.outerWidth,
        height: layout.outerHeight,
        padding: `${layout.contentOffsetY}px ${layout.contentOffsetX}px`,
        '--vn-accent': visual.spec.accent,
        '--vn-muted': visual.spec.muted,
        '--vn-border': visual.spec.border,
      }}
      data-visual-type={visual.visualType}
      data-runtime-type={visual.runtimeType}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="flow-node-card-hit cicada-node-hit visual-node-card-hit"
        role="button"
        tabIndex={0}
        aria-label={visual.title}
        onPointerDown={onHitPointerDown}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          cursor: editingField ? 'default' : 'grab',
          borderRadius: 16,
        }}
      />

      <Surface
        className={`visual-node-card__surface${lazyRender ? ' visual-node-card__surface--lazy' : ''}`}
        style={{ minHeight: layout.height }}
        {...surfaceProps}
      >
        <header className="visual-node-card__header">
          <div className="visual-node-card__icon-wrap" aria-hidden>
            {visual.icon}
          </div>
          <div className="visual-node-card__head-text">
            <div className="visual-node-card__type-label">
              {lang === 'en' ? visual.spec.labelEn : visual.spec.labelRu}
            </div>
            <div className="visual-node-card__title" title={visual.title}>
              {visual.title}
            </div>
          </div>
        </header>

        <section className="visual-node-card__body" style={{ minHeight: richPreview ? layout.bodyH : 28 }}>
          {richPreview && (
            <div className="visual-node-card__preview-label">{visual.content.previewTitle}</div>
          )}
          {!richPreview ? (
            <div className="visual-node-card__preview-compact">{visual.title}</div>
          ) : editingField && visual.content.inlineEdit ? (
            <textarea
              className="visual-node-card__preview-input nodrag"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitInlineEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  commitInlineEdit();
                }
                if (e.key === 'Escape') setEditingField(null);
              }}
              placeholder={visual.content.inlineEdit.placeholder}
              autoFocus
              onPointerDown={stopBubble}
            />
          ) : (
            <div
              className="visual-node-card__preview-text"
              style={{ WebkitLineClamp: Math.min(5, visual.content.bodyLineCount + 1) }}
              title={visual.content.previewBody}
              onDoubleClick={startInlineEdit}
              onPointerDown={stopBubble}
            >
              {visual.content.previewBody}
            </div>
          )}
        </section>

        {richPreview && (
        <footer className="visual-node-card__footer">
          {visual.content.chips.map((chip, i) => (
            <span
              key={chip}
              className={`visual-node-card__chip${i === 0 ? ' visual-node-card__chip--primary' : ''}`}
            >
              {chip}
            </span>
          ))}
          {visual.content.analyticsBadge && (
            <span className="visual-node-card__analytics" title={lang === 'en' ? 'Analytics' : 'Аналитика'}>
              📊 {visual.content.analyticsBadge}
            </span>
          )}
          {visual.content.status && (
            <span className="visual-node-card__status">{visual.content.status}</span>
          )}
        </footer>
        )}
      </Surface>

      <div className="visual-node-card__actions" onPointerDown={stopBubble}>
        {actions?.onAddAfterNode && (
          <button
            type="button"
            className="visual-node-card__action-btn"
            title={lang === 'en' ? 'Add next' : 'Добавить шаг'}
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
            className="visual-node-card__action-btn"
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
            className="visual-node-card__action-btn visual-node-card__action-btn--danger"
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

      {layout.hasTopSocket && visual.inputPort && (
        <Handle
          type="target"
          position={Position.Top}
          id={visual.inputPort.id}
          className="visual-node-card__handle"
          style={{
            top: layout.contentOffsetY - 5,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        />
      )}

      {visual.outputPorts.length <= 1 ? (
        visual.outputPorts.length === 1 && (
          <Handle
            type="source"
            position={Position.Bottom}
            id={visual.outputPorts[0].id}
            className="visual-node-card__handle"
            style={{
              bottom: layout.contentOffsetY - 5,
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          />
        )
      ) : (
        visual.outputPorts.map((port, index) => {
          const pct = ((index + 1) / (visual.outputPorts.length + 1)) * 100;
          return (
            <React.Fragment key={port.id}>
              <Handle
                type="source"
                position={Position.Bottom}
                id={port.id}
                className="visual-node-card__handle"
                style={{
                  bottom: layout.contentOffsetY - 5,
                  left: `${pct}%`,
                  transform: 'translateX(-50%)',
                }}
              />
              {port.label && (
                <span
                  className="visual-node-card__handle-label"
                  style={{
                    bottom: layout.contentOffsetY - 20,
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

function visualNodeCardPropsAreEqual(prev, next) {
  if (prev.selected !== next.selected) return false;
  if (prev.id !== next.id) return false;
  const pd = prev.data || {};
  const nd = next.data || {};
  if (pd.canvasBlockType !== nd.canvasBlockType) return false;
  if (pd.visualType !== nd.visualType) return false;
  if (pd.previewEpoch !== nd.previewEpoch) return false;
  if (pd.repairPulse !== nd.repairPulse) return false;
  if (pd.executionPath !== nd.executionPath) return false;
  if (pd.snapHint !== nd.snapHint) return false;
  if (pd.isChainRoot !== nd.isChainRoot) return false;
  if (pd.lazyRender !== nd.lazyRender) return false;
  if (pd.zoomTier !== nd.zoomTier) return false;
  if (pd.label !== nd.label) return false;
  if (JSON.stringify(pd.props) !== JSON.stringify(nd.props)) return false;
  if (JSON.stringify(pd.meta) !== JSON.stringify(nd.meta)) return false;
  return true;
}

export default React.memo(VisualNodeCard, visualNodeCardPropsAreEqual);
export { VISUAL_NODE_CARD_WIDTH } from './visualNodeLayout.js';
