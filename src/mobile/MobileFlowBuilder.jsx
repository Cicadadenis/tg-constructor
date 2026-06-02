import React, { useMemo, useState, useCallback } from 'react';
import { graphResolveNodeType } from '../app/graph/graphHelpers.js';
import { getBlockDef } from '../constructor/block_catalog.js';
import { getNodeCardContent } from '../builder/nodeCard/nodeCardContent.js';
import { getBlockDefinition } from '../../core/blockRegistry.js';
import './mobile-flow-builder.css';

const QUICK_BLOCKS = Object.freeze([
  { id: 'message', icon: '💬', type: 'message', labelRu: 'Сообщение', labelEn: 'Message' },
  { id: 'buttons', icon: '🧩', type: 'buttons', labelRu: 'Кнопки', labelEn: 'Buttons' },
  { id: 'condition', icon: '⑂', type: 'condition', labelRu: 'Условие', labelEn: 'Condition' },
  { id: 'media', icon: '🖼️', type: 'photo', labelRu: 'Медиа', labelEn: 'Media' },
  { id: 'action', icon: '⚡', type: 'goto', labelRu: 'Действие', labelEn: 'Action' },
]);

export default function MobileFlowBuilder({
  lang = 'ru',
  graph,
  graphRevision = 0,
  blockTypes = [],
  selectedBlockId = null,
  onSelectNode,
  onOpenAi,
  onOpenSettings,
  onInsertAfter,
}) {
  const doc = graph.getGraphDocument();
  const nodes = doc.nodes || {};
  const edges = doc.edges || {};
  const nodeIds = useMemo(() => Object.keys(nodes), [nodes, graphRevision]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [insertAnchorId, setInsertAnchorId] = useState(null);

  const isEmpty = nodeIds.length === 0;

  const openInsert = useCallback((anchorId) => {
    setInsertAnchorId(anchorId || null);
    setSheetOpen(true);
  }, []);

  const closeInsert = useCallback(() => setSheetOpen(false), []);

  const chain = useMemo(() => buildPrimaryChain(nodes, edges), [nodes, edges, graphRevision]);

  const emptyTitle = lang === 'en'
    ? 'Create your first flow'
    : lang === 'uk'
      ? 'Створіть перший сценарій'
      : 'Создайте первый сценарий';
  const emptyCta = lang === 'en'
    ? 'Add first block'
    : lang === 'uk'
      ? 'Додати перший блок'
      : 'Добавить первый блок';

  return (
    <div className="mfb">
      {isEmpty ? (
        <div className="mfb-empty">
          <div className="mfb-empty__card">
            <div className="mfb-empty__icon" aria-hidden>🔗</div>
            <h2 className="mfb-empty__title">{emptyTitle}</h2>
            <button
              type="button"
              className="mfb-btn mfb-btn--primary"
              onClick={() => openInsert(null)}
            >
              {emptyCta}
            </button>
            {onOpenAi && (
              <button
                type="button"
                className="mfb-btn"
                onClick={onOpenAi}
              >
                ✨ {lang === 'en' ? 'Create with AI' : lang === 'uk' ? 'Створити через AI' : 'Создать с ИИ'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mfb-list" role="list">
          {chain.map((id, idx) => {
            const node = nodes[id];
            if (!node) return null;
            const type = graphResolveNodeType(node);
            const def = getBlockDef(type, blockTypes);
            const reg = getBlockDefinition(type);
            const content = getNodeCardContent(type, node.data, node.meta, { label: def?.label, description: reg?.description, category: reg?.category, lang });
            const selected = selectedBlockId === id;
            const branches = isConditionType(type) ? resolveConditionBranches(id, edges) : null;

            return (
              <div key={id} className="mfb-item" role="listitem">
                <button
                  type="button"
                  className={`mfb-card${selected ? ' is-selected' : ''}`}
                  onClick={() => {
                    onSelectNode?.(id);
                    onOpenSettings?.();
                  }}
                >
                  <div className="mfb-card__head">
                    <div className="mfb-card__icon" aria-hidden>{def?.icon || '⬛'}</div>
                    <div className="mfb-card__meta">
                      <div className="mfb-card__badge">{content.categoryLabel}</div>
                      <div className="mfb-card__title">{def?.label || type}</div>
                    </div>
                    <div className="mfb-card__type">{type}</div>
                  </div>
                  <div className="mfb-card__body">
                    <div className="mfb-card__preview-title">{content.previewTitle}</div>
                    <div className="mfb-card__preview">{content.previewBody}</div>
                  </div>
                  {branches && (
                    <div className="mfb-branches" aria-label="Branches">
                      <div className="mfb-branch">
                        <span className="mfb-branch__pill mfb-branch__pill--true">TRUE</span>
                        <span className="mfb-branch__target">{branches.trueTarget || '—'}</span>
                      </div>
                      <div className="mfb-branch">
                        <span className="mfb-branch__pill mfb-branch__pill--false">FALSE</span>
                        <span className="mfb-branch__target">{branches.falseTarget || '—'}</span>
                      </div>
                    </div>
                  )}
                </button>

                <div className="mfb-between" aria-hidden>
                  <div className="mfb-arrow">↓</div>
                  <button type="button" className="mfb-plus" onClick={() => openInsert(id)}>
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddBlockSheet
        open={sheetOpen}
        onClose={closeInsert}
        lang={lang}
        onPick={(type) => {
          setSheetOpen(false);
          const anchor = insertAnchorId || selectedBlockId || nodeIds[nodeIds.length - 1] || null;
          onInsertAfter?.(anchor, type);
        }}
      />
    </div>
  );
}

function AddBlockSheet({ open, onClose, lang, onPick }) {
  if (!open) return null;
  return (
    <div className="mfb-sheet__backdrop" onClick={onClose} role="presentation">
      <div className="mfb-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Add block">
        <div className="mfb-sheet__handle" aria-hidden />
        <div className="mfb-sheet__head">
          <strong>{lang === 'en' ? 'Add block' : lang === 'uk' ? 'Додати блок' : 'Добавить блок'}</strong>
          <button type="button" className="mfb-sheet__close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="mfb-sheet__grid">
          {QUICK_BLOCKS.map((b) => (
            <button key={b.id} type="button" className="mfb-sheet__tile" onClick={() => onPick?.(b.type)}>
              <div className="mfb-sheet__tile-icon" aria-hidden>{b.icon}</div>
              <div className="mfb-sheet__tile-title">{lang === 'en' ? b.labelEn : b.labelRu}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function buildPrimaryChain(nodes, edges) {
  const bySource = new Map();
  for (const e of Object.values(edges || {})) {
    const src = e.source;
    if (!src) continue;
    if (!bySource.has(src)) bySource.set(src, []);
    bySource.get(src).push(e);
  }

  const startId = Object.values(nodes).find((n) => graphResolveNodeType(n) === 'start')?.id
    || Object.keys(nodes)[0]
    || null;
  if (!startId) return [];

  const out = [];
  const seen = new Set();
  let cur = startId;
  while (cur && !seen.has(cur) && out.length < 80) {
    out.push(cur);
    seen.add(cur);
    const outs = (bySource.get(cur) || []).filter((e) => (e.sourcePort || 'flow') === 'flow');
    const next = outs[0]?.target || null;
    cur = next;
  }
  return out;
}

function isConditionType(type) {
  return type === 'condition' || type === 'condition_not' || type === 'switch';
}

function resolveConditionBranches(nodeId, edges) {
  const out = { trueTarget: null, falseTarget: null };
  for (const e of Object.values(edges || {})) {
    if (e.source !== nodeId) continue;
    if (e.sourcePort === 'true') out.trueTarget = e.target;
    if (e.sourcePort === 'false') out.falseTarget = e.target;
  }
  return out;
}

