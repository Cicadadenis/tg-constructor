import React, { useCallback, useEffect, useRef } from 'react';
import { useAiFlowStore } from './aiFlowStore.js';
import {
  suggestNodes,
  autocompleteFlow,
  optimizeFlow,
  repairFlow,
  copywritingAssist,
  suggestBranches,
} from './aiFlowClient.js';
import { insertSuggestedNode, applyRepairOperations } from './applyAiAssist.js';
import { graphResolveNodeType } from '../constructor/graph_document/graph_node_payload.js';

const COPILOT_ACTIONS = [
  { id: 'suggest_nodes', label: 'Узлы', icon: '🧩' },
  { id: 'autocomplete', label: 'Дополнить', icon: '⚡' },
  { id: 'optimize', label: 'Подсказки', icon: '💡' },
  { id: 'repair', label: 'Починить', icon: '🔧' },
  { id: 'copywriting', label: 'Текст', icon: '✍️' },
  { id: 'branches', label: 'Ветки', icon: '⑂' },
];

/**
 * Contextual AI copilot — attaches to inspector when a node is selected.
 */
export default function AiCopilotPanel({
  graph,
  selectedBlockId,
  selectedBlock,
  onApplyText,
  onRepairHighlight,
  lang = 'ru',
}) {
  const {
    suggestions,
    hints,
    repair,
    branches,
    copywriting,
    loading,
    loadingAction,
    error,
    copilotOpen,
  } = useAiFlowStore();

  const graphRef = useRef(graph);
  graphRef.current = graph;
  const selectedBlockRef = useRef(selectedBlock);
  selectedBlockRef.current = selectedBlock;
  const onRepairHighlightRef = useRef(onRepairHighlight);
  onRepairHighlightRef.current = onRepairHighlight;

  const runAction = useCallback(async (action) => {
    const g = graphRef.current;
    const doc = g?.getGraphDocument?.() ?? { nodes: {}, edges: {} };
    const blockId = selectedBlockId;
    const block = selectedBlockRef.current;
    useAiFlowStore.getState().patch({ loading: true, loadingAction: action, error: null });
    try {
      switch (action) {
        case 'suggest_nodes': {
          const res = await suggestNodes(doc, blockId);
          useAiFlowStore.getState().patch({ suggestions: res.suggestions || [] });
          break;
        }
        case 'autocomplete': {
          const res = await autocompleteFlow(doc, blockId);
          useAiFlowStore.getState().patch({ suggestions: res.alternatives || [res.suggestedNext].filter(Boolean) });
          break;
        }
        case 'optimize': {
          const res = await optimizeFlow(doc);
          useAiFlowStore.getState().patch({ hints: res.hints || [] });
          break;
        }
        case 'repair': {
          const res = await repairFlow(doc);
          const r = res.repair;
          useAiFlowStore.getState().patch({ repair: r });
          if (r?.operations?.length) {
            applyRepairOperations(g, r);
            onRepairHighlightRef.current?.(r.highlights);
          }
          break;
        }
        case 'copywriting': {
          const text = block?.props?.text || block?.props?.question || '';
          const res = await copywritingAssist(text, { prompt: '' });
          useAiFlowStore.getState().patch({ copywriting: res.copywriting });
          break;
        }
        case 'branches': {
          const res = await suggestBranches(doc, blockId);
          useAiFlowStore.getState().patch({ branches: res });
          break;
        }
        default:
          break;
      }
    } catch (e) {
      useAiFlowStore.getState().patch({ error: e.message });
    } finally {
      useAiFlowStore.getState().patch({ loading: false, loadingAction: null });
    }
  }, [selectedBlockId]);

  const runActionRef = useRef(runAction);
  runActionRef.current = runAction;
  const autoSuggestKeyRef = useRef('');

  useEffect(() => {
    if (!copilotOpen) {
      autoSuggestKeyRef.current = '';
    }
  }, [copilotOpen]);

  useEffect(() => {
    if (!selectedBlockId || !copilotOpen) return;
    const key = String(selectedBlockId);
    if (autoSuggestKeyRef.current === key) return;
    autoSuggestKeyRef.current = key;
    const t = setTimeout(() => runActionRef.current('suggest_nodes'), 400);
    return () => clearTimeout(t);
  }, [selectedBlockId, copilotOpen]);

  if (!copilotOpen) {
    return (
      <button
        type="button"
        className="ai-copilot__open"
        onClick={() => useAiFlowStore.getState().patch({ copilotOpen: true })}
      >
        {lang === 'ru' ? 'AI Copilot' : 'AI Copilot'}
      </button>
    );
  }

  return (
    <section className="ai-copilot" aria-label="AI Copilot">
      <header className="ai-copilot__head">
        <span className="ai-copilot__badge">AI</span>
        <strong>{lang === 'ru' ? 'Copilot' : 'Copilot'}</strong>
        <button
          type="button"
          className="ai-copilot__toggle"
          onClick={() => useAiFlowStore.getState().patch({ copilotOpen: false })}
        >
          ×
        </button>
      </header>

      <div className="ai-copilot__actions">
        {COPILOT_ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`ai-copilot__action ${loadingAction === a.id ? 'is-loading' : ''}`}
            disabled={loading}
            onClick={() => runAction(a.id)}
          >
            <span>{a.icon}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>

      {error && <p className="ai-copilot__error">{error}</p>}

      {suggestions.length > 0 && (
        <div className="ai-copilot__block">
          <h4>Предложенные узлы</h4>
          <ul className="ai-copilot__list">
            {suggestions.map((s) => (
              <li key={s.type}>
                <button
                  type="button"
                  className="ai-copilot__suggest-btn"
                  onClick={() => insertSuggestedNode(graph, selectedBlockId, s)}
                >
                  <code>{s.type}</code>
                  <span>{s.reason}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hints.length > 0 && (
        <div className="ai-copilot__block">
          <h4>Оптимизация</h4>
          <ul className="ai-copilot__hints">
            {hints.map((h, i) => (
              <li key={`${h.code}-${i}`} className={`severity-${h.severity}`}>
                {h.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {branches?.branches?.length > 0 && (
        <div className="ai-copilot__block">
          <h4>Ветки ({graphResolveNodeType({ type: branches.nodeType, data: {} }) || branches.nodeType})</h4>
          <ul className="ai-copilot__list">
            {branches.branches.map((b) => (
              <li key={b.port + b.label}>
                <strong>{b.label}</strong>
                <span>{b.suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {copywriting?.variants?.length > 0 && (
        <div className="ai-copilot__block">
          <h4>AI Copywriting</h4>
          {copywriting.variants.map((v, i) => (
            <button
              key={i}
              type="button"
              className="ai-copilot__variant"
              onClick={() => onApplyText?.('text', v)}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {repair?.fixes?.length > 0 && (
        <div className="ai-copilot__block">
          <h4>Исправлено: {repair.fixes.length}</h4>
        </div>
      )}
    </section>
  );
}
