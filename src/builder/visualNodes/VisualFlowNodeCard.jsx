import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { BuilderUiContext } from '../../builderContext.js';
import { getBlockDef } from '../../constructor/block_catalog.js';
import { graphResolveNodeType } from '../../app/graph/graphHelpers.js';
import { getBlockDefinition } from '../../../core/blockRegistry.js';
import { useGraphCanvasActions } from '../graphCanvasActionsContext.jsx';
import { resolveVisualEditorNode } from './resolveVisualNode.js';
import { getVisualNodeLayout, VISUAL_NODE_CARD_WIDTH } from './visualNodeLayout.js';
import { portKindTheme } from './visualPortTheme.js';
import './visual-node-card.css';

function stopBubble(e) {
  e.stopPropagation();
}

/**
 * ManyChat-style visual editor card. Runtime type stays in GraphDocument; visual layer is projection-only.
 */
function VisualFlowNodeCard({ id, data, selected }) {
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
    paletteLabel: def?.label,
    description: registryDef?.description,
    isChainRoot,
    lang,
  });

  const layout = getVisualNodeLayout({
    isChainRoot,
    bodyLineCount: visual.content.bodyLineCount,
    outputPorts: visual.outputPorts,
  });

  const [hovered, setHovered] = React.useState(false);
  const [editingField, setEditingField] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const showActions = hovered || selected;
  const inline = visual.content.inlineEdit;
  const props = data?.props || {};

  React.useEffect(() => {
    if (!editingField || !inline) return;
    setDraft(String(props[inline.field] ?? ''));
  }, [editingField, inline, props]);

  const commitInline = React.useCallback(() => {
    if (!inline || !nodeId) {
      setEditingField(false);
      return;
    }
    const next = draft.trim();
    const prev = String(props[inline.field] ?? '').trim();
    if (next !== prev) {
      actions?.onInlineEdit?.(nodeId, inline.field, next);
    }
    setEditingField(false);
  }, [actions, draft, inline, nodeId, props]);

  const onHitPointerDown = (e) => {
    if (e.button !== 0) return;
    if (editingField) return;
    actions?.onSelectNode?.(nodeId);
  };

  const snapClass = snapHint === 'ok' ? ' snap-ok' : snapHint === 'bad' ? ' snap-bad' : '';
  const execClass = data?.executionPath ? ' visual-node-card--executing' : '';
  const repairClass = data?.repairPulse ? ' visual-node-card--repair' : '';

  const accentStyle = {
    '--vn-accent': visual.spec.accent,
    '--vn-muted': visual.spec.muted,
    '--vn-border': visual.spec.border,
  };

  const hasInput = layout.hasTopSocket && visual.inputPort;

  return (
    <div
      className={`visual-node-card visual-node-card--${visual.visualType}${selected ? ' selected' : ''}${showActions ? ' show-actions' : ''}${snapClass}${execClass}${repairClass}`}
      style={{
        ...accentStyle,
        width: layout.outerWidth,
        height: layout.outerHeight,
        padding: `${layout.contentOffsetY}px ${layout.contentOffsetX}px`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="visual-node-card-hit cicada-node-hit"
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

      <div className="visual-node-card__surface" style={{ minHeight: layout.height }}>
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
          {visual.content.analyticsBadge && (
            <span className="visual-node-card__analytics" title={lang === 'en' ? 'Analytics' : 'Аналитика'}>
              {visual.content.analyticsBadge}
            </span>
          )}
        </header>

        <section className="visual-node-card__body" style={{ minHeight: layout.bodyH }}>
          <div className="visual-node-card__preview-label">{visual.content.previewTitle}</div>
          {editingField && inline ? (
            <textarea
              className="visual-node-card__preview-input"
              value={draft}
              placeholder={inline.placeholder}
              rows={3}
              autoFocus
              onPointerDown={stopBubble}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitInline}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  commitInline();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setEditingField(false);
                }
              }}
            />
          ) : (
            <div
              className="visual-node-card__preview-text"
              style={{ WebkitLineClamp: Math.min(5, visual.content.bodyLineCount + 1) }}
              title={visual.content.previewBody}
              onDoubleClick={(e) => {
                if (!inline) return;
                stopBubble(e);
                setEditingField(true);
              }}
            >
              {visual.content.previewBody}
            </div>
          )}
        </section>

        <footer className="visual-node-card__footer">
          {visual.content.chips.map((chip, i) => (
            <span
              key={chip}
              className={`visual-node-card__chip${i === 0 ? ' visual-node-card__chip--primary' : ''}`}
            >
              {chip}
            </span>
          ))}
          {visual.content.status && (
            <span className="visual-node-card__status">{visual.content.status}</span>
          )}
        </footer>
      </div>

      <div className="visual-node-card__actions" onPointerDown={stopBubble}>
        {inline && !editingField && (
          <button
            type="button"
            className="visual-node-card__action-btn"
            title={lang === 'en' ? 'Edit inline' : 'Редактировать'}
            onClick={(e) => {
              e.stopPropagation();
              setEditingField(true);
            }}
          >
            ✎
          </button>
        )}
        {actions?.onAddAfterNode && (
          <button
            type="button"
            className="visual-node-card__action-btn"
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

      {hasInput && (
        <Handle
          type="target"
          position={Position.Top}
          id={visual.inputPort.id}
          className="visual-node-card__handle visual-port--flow"
          style={{
            top: layout.contentOffsetY - 5,
            left: '50%',
            transform: 'translateX(-50%)',
            background: visual.spec.accent,
          }}
        />
      )}

      {visual.outputPorts.length === 1 && (() => {
        const port = visual.outputPorts[0];
        const theme = portKindTheme(port.kind);
        return (
          <Handle
            type="source"
            position={Position.Bottom}
            id={port.id}
            className={`visual-node-card__handle ${theme.className}`}
            style={{
              bottom: layout.contentOffsetY - 5,
              left: '50%',
              transform: 'translateX(-50%)',
              background: theme.color,
            }}
          />
        );
      })()}

      {visual.outputPorts.length > 1 && (
        visual.outputPorts.map((port, index) => {
          const pct = ((index + 1) / (visual.outputPorts.length + 1)) * 100;
          const theme = portKindTheme(port.kind);
          return (
            <React.Fragment key={port.id}>
              <Handle
                type="source"
                position={Position.Bottom}
                id={port.id}
                className={`visual-node-card__handle ${theme.className}`}
                style={{
                  bottom: layout.contentOffsetY - 5,
                  left: `${pct}%`,
                  transform: 'translateX(-50%)',
                  background: theme.color,
                }}
              />
              {port.label && (
                <span
                  className="visual-node-card__handle-label"
                  style={{
                    bottom: layout.contentOffsetY - 20,
                    left: `${pct}%`,
                    color: theme.labelColor,
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

function visualFlowNodeCardPropsAreEqual(prev, next) {
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

export default React.memo(VisualFlowNodeCard, visualFlowNodeCardPropsAreEqual);
export { VISUAL_NODE_CARD_WIDTH as NODE_CARD_WIDTH };
