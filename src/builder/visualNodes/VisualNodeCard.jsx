import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { tierAllowsMotion, tierAllowsRichPreview } from '../../performance/zoomTier.js';
import { BuilderUiContext } from '../../builderContext.js';
import { getBlockDef } from '../../constructor/block_catalog.js';
import { graphResolveNodeType } from '../../app/graph/graphHelpers.js';
import { getBlockDefinition } from '../../../core/blockRegistry.js';
import { useGraphCanvasActions } from '../graphCanvasActionsContext.jsx';
import { resolveVisualEditorNode } from './resolveVisualNode.js';
import { getVisualNodeLayout } from './visualNodeLayout.js';
import { MC_SPRING, nodeSurfaceVariants } from '../../motion/index.js';
import NodeCardPorts from './NodeCardPorts.jsx';
import NodeHoverToolbar from './NodeHoverToolbar.jsx';
import './visual-node-card.css';

/**
 * ManyChat-style flow node — content-first, icon-driven, marketer-friendly.
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
  const showChrome = hovered || selected;

  const stopBubble = (e) => e.stopPropagation();

  const onHitPointerDown = (e) => {
    if (e.button !== 0 || editingField) return;
    actions?.onSelectNode?.(nodeId);
  };

  const startInlineEdit = (e) => {
    const spec = visual.content.inlineEdit;
    if (!spec || !actions?.onInlineEdit) return;
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
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
  const execClass = data?.executionPath ? ' vn-card--executing' : '';
  const repairClass = data?.repairPulse ? ' vn-card--repair' : '';
  const motionState = selected ? 'selected' : hovered ? 'hover' : 'rest';
  const lazyRender = Boolean(data?.lazyRender);
  const zoomTier = data?.zoomTier || 'full';
  const richPreview = tierAllowsRichPreview(zoomTier) && !lazyRender;
  const useMotion = tierAllowsMotion(zoomTier) && !lazyRender;
  const Surface = useMotion ? motion.div : 'div';
  const surfaceProps = useMotion
    ? {
      variants: nodeSurfaceVariants,
      initial: 'rest',
      animate: motionState,
      transition: MC_SPRING.node,
    }
    : {};

  const typeLabel = lang === 'en' ? visual.spec.labelEn : visual.spec.labelRu;
  const statusTone = visual.content.status === 'Ошибка' || visual.content.status === 'Error'
    ? 'error'
    : isChainRoot
      ? 'start'
      : visual.visualType === 'condition'
        ? 'branch'
        : 'default';

  return (
    <div
      className={[
        'vn-card',
        `vn-card--${visual.visualType}`,
        selected ? 'vn-card--selected' : '',
        showChrome ? 'vn-card--hover' : '',
        snapClass,
        execClass,
        repairClass,
        lazyRender ? 'vn-card--lazy' : '',
      ].filter(Boolean).join(' ')}
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
        className="vn-card__hit cicada-node-hit"
        role="button"
        tabIndex={0}
        aria-label={visual.title}
        onPointerDown={onHitPointerDown}
      />

      <NodeHoverToolbar
        visible={showChrome && richPreview}
        lang={lang}
        hasInlineEdit={Boolean(visual.content.inlineEdit)}
        onEdit={visual.content.inlineEdit ? startInlineEdit : undefined}
        onAdd={actions?.onAddAfterNode ? () => actions.onAddAfterNode(nodeId) : undefined}
        onDuplicate={actions?.onDuplicateNode ? () => actions.onDuplicateNode(nodeId) : undefined}
        onDelete={actions?.onDeleteNode ? () => actions.onDeleteNode(nodeId) : undefined}
      />

      <Surface
        className={`vn-card__surface${lazyRender ? ' vn-card__surface--lazy' : ''}`}
        style={{ minHeight: layout.height }}
        {...surfaceProps}
      >
        <div className="vn-card__accent" aria-hidden />

        <header className="vn-card__header">
          <div className="vn-card__icon" aria-hidden>
            <span className="vn-card__icon-emoji">{visual.icon}</span>
          </div>
          <div className="vn-card__meta">
            <span className="vn-card__type">{typeLabel}</span>
            <h3 className="vn-card__title" title={visual.title}>{visual.title}</h3>
          </div>
          {visual.content.analyticsBadge && (
            <span className="vn-card__analytics" title={lang === 'en' ? 'Engagement' : 'Аналитика'}>
              <span className="vn-card__analytics-icon" aria-hidden>📊</span>
              {visual.content.analyticsBadge}
            </span>
          )}
        </header>

        <section className="vn-card__content" style={{ minHeight: richPreview ? layout.bodyH : 40 }}>
          {!richPreview ? (
            <p className="vn-card__content-compact">{visual.title}</p>
          ) : editingField && visual.content.inlineEdit ? (
            <textarea
              className="vn-card__content-input nodrag"
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
              className="vn-card__preview"
              style={{ WebkitLineClamp: Math.min(6, visual.content.bodyLineCount + 2) }}
              title={visual.content.previewBody}
              onDoubleClick={startInlineEdit}
              onPointerDown={stopBubble}
            >
              {visual.content.previewBody}
            </div>
          )}
        </section>

        {richPreview && (visual.content.chips.length > 0 || visual.content.status) && (
          <footer className="vn-card__footer">
            <div className="vn-card__chips">
              {visual.content.chips.map((chip, i) => (
                <span
                  key={chip}
                  className={`vn-card__chip${i === 0 ? ' vn-card__chip--accent' : ''}`}
                >
                  {chip}
                </span>
              ))}
            </div>
            {visual.content.status && (
              <span className={`vn-card__status vn-card__status--${statusTone}`}>
                <span className="vn-card__status-dot" aria-hidden />
                {visual.content.status}
              </span>
            )}
          </footer>
        )}
      </Surface>

      {richPreview && (
        <NodeCardPorts
          layout={layout}
          visual={visual}
          lang={lang}
          hovered={hovered}
          selected={selected}
          showInsert={Boolean(actions?.onAddAfterNode)}
          onInsert={() => actions?.onAddAfterNode?.(nodeId)}
        />
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
