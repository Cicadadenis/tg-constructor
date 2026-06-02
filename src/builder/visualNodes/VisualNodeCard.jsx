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

function getNodeFlavor(runtimeType, visualType) {
  const t = String(runtimeType || '').trim();
  if (['buttons', 'inline', 'inline_keyboard', 'reply_keyboard', 'callback'].includes(t)) return 'buttons';
  if ([
    'photo',
    'video',
    'audio',
    'document',
    'sticker',
    'contact',
    'location',
    'poll',
    'send_file',
    'photo_var',
    'document_var',
    'media',
  ].includes(t)) return 'media';
  if (visualType === 'condition') return 'condition';
  if (visualType === 'action' || ['goto', 'stop', 'log', 'require_role', 'bot', 'version', 'commands'].includes(t)) return 'action';
  if (visualType === 'message') return 'message';
  return visualType;
}

function getFlavorLabel(flavor) {
  switch (flavor) {
    case 'message': return 'Message';
    case 'condition': return 'Condition';
    case 'buttons': return 'Buttons';
    case 'media': return 'Media';
    case 'action': return 'Action';
    case 'input': return 'Input';
    case 'delay': return 'Delay';
    case 'variable': return 'Variable';
    case 'tag': return 'Tag';
    case 'api_request': return 'API';
    case 'goal': return 'Trigger';
    case 'split': return 'Split';
    case 'sequence': return 'Sequence';
    default: return flavor;
  }
}

function NodeTypeIcon({ flavor, visualType }) {
  const props = {
    width: 20,
    height: 20,
    viewBox: '0 0 20 20',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
  };

  switch (flavor) {
    case 'condition':
      return (
        <svg {...props}>
          <path d="M6 4h8l4 6-4 6H6L2 10l4-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M7.4 10h5.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case 'buttons':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="14" height="4" rx="2" stroke="currentColor" strokeWidth="1.7" />
          <rect x="3" y="12" width="6" height="4" rx="2" stroke="currentColor" strokeWidth="1.7" />
          <rect x="11" y="12" width="6" height="4" rx="2" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      );
    case 'media':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="14" height="12" rx="3" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="8" cy="8" r="1.35" fill="currentColor" />
          <path d="m6 14 3.15-3.1a1 1 0 0 1 1.38 0L12 12.35l1.45-1.45a1 1 0 0 1 1.4 0L16 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'action':
      return (
        <svg {...props}>
          <path d="M11.4 3 6.9 10h3L8.6 17l4.5-7h-3L11.4 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'message':
      return (
        <svg {...props}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h7A2.5 2.5 0 0 1 16 5.5v5a2.5 2.5 0 0 1-2.5 2.5H9l-3.5 3V13H6.5A2.5 2.5 0 0 1 4 10.5v-5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    default:
      if (visualType === 'input') {
        return (
          <svg {...props}>
            <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h7A2.5 2.5 0 0 1 16 6.5v3a2.5 2.5 0 0 1-2.5 2.5H10l-4 4v-4H6.5A2.5 2.5 0 0 1 4 9.5v-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            <path d="M8 8h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        );
      }
      return (
        <svg {...props}>
          <rect x="4" y="4" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      );
  }
}

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
  const flavor = getNodeFlavor(visual.runtimeType, visual.visualType);
  const flavorLabel = getFlavorLabel(flavor);
  const isInvalid = Boolean(data?.meta?.invalid || visual.content.status === 'Ошибка' || visual.content.status === 'Error');
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
        `vn-card--flavor-${flavor}`,
        selected ? 'vn-card--selected' : '',
        showChrome ? 'vn-card--hover' : '',
        isInvalid ? 'vn-card--invalid' : '',
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
      data-card-flavor={flavor}
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
            <NodeTypeIcon flavor={flavor} visualType={visual.visualType} />
          </div>
          <div className="vn-card__meta">
            <div className="vn-card__meta-top">
              <span className={`vn-card__badge vn-card__badge--${flavor}`}>{flavorLabel}</span>
              <span className="vn-card__type">{typeLabel}</span>
            </div>
            <h3 className="vn-card__title" title={visual.title}>{visual.title}</h3>
            <p className="vn-card__subtitle" title={typeLabel}>{typeLabel}</p>
          </div>
          {visual.content.analyticsBadge && (
            <span className="vn-card__analytics" title={lang === 'en' ? 'Engagement' : 'Аналитика'}>
              <span className="vn-card__analytics-icon" aria-hidden>•</span>
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
