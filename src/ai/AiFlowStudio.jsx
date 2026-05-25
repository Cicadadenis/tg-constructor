import React, { useCallback, useEffect, useState } from 'react';
import { useAiFlowStore } from './aiFlowStore.js';
import {
  PROMPT_TEMPLATE_CATEGORIES,
  getTemplatesByCategory,
  AI_PROMPT_MAX_CHARS,
} from './promptTemplates.js';
import { FLOW_TEMPLATES } from './flowTemplates.js';
import {
  planFlow,
  prepareFlowGeneration,
  generateFlowFromPrompt,
} from './aiFlowClient.js';
import { normalizeAiPartialResponse } from '../builder/BuilderComponents.jsx';
import './ai-flow-studio.css';

const TABS = [
  { id: 'generate', label: 'Generate', icon: '✨' },
  { id: 'templates', label: 'Templates', icon: '📋' },
  { id: 'plan', label: 'Preview', icon: '🔮' },
];

/**
 * ManyChat / Notion AI-style flow generation studio.
 */
export default function AiFlowStudio({
  open,
  onClose,
  onApplyStacks,
  canUseAi = true,
  onUpgrade,
  lang = 'ru',
}) {
  const store = useAiFlowStore();
  const {
    prompt,
    category,
    loading,
    error,
    plan,
    activeTab,
  } = store;

  const setPrompt = (v) => useAiFlowStore.getState().patch({ prompt: v });
  const setCategory = (v) => useAiFlowStore.getState().patch({ category: v });
  const setTab = (v) => useAiFlowStore.getState().patch({ activeTab: v });

  const [localStep, setLocalStep] = useState(0);

  useEffect(() => {
    if (!open) return;
    useAiFlowStore.getState().patch({ error: null });
  }, [open]);

  const runPlan = useCallback(async () => {
    if (!prompt.trim() || prompt.trim().length < 3) {
      useAiFlowStore.getState().patch({ error: 'Опишите сценарий минимум 3 символа' });
      return;
    }
    useAiFlowStore.getState().patch({ loading: true, loadingAction: 'plan', error: null });
    try {
      const res = await planFlow(prompt.trim());
      useAiFlowStore.getState().patch({ plan: res.plan, activeTab: 'plan' });
    } catch (e) {
      useAiFlowStore.getState().patch({ error: e.message });
    } finally {
      useAiFlowStore.getState().patch({ loading: false, loadingAction: null });
    }
  }, [prompt]);

  const runGenerate = useCallback(async () => {
    if (!canUseAi) {
      onUpgrade?.();
      return;
    }
    if (!prompt.trim() || prompt.trim().length < 5) {
      useAiFlowStore.getState().patch({ error: 'Опишите сценарий подробнее (мин. 5 символов)' });
      return;
    }
    useAiFlowStore.getState().patch({ loading: true, loadingAction: 'generate', error: null });
    setLocalStep(0);
    const stepTimer = setInterval(() => setLocalStep((s) => Math.min(s + 1, 4)), 900);
    try {
      const prep = await prepareFlowGeneration(prompt.trim());
      const expanded = prep.expandedPrompt || prompt.trim();
      const data = await generateFlowFromPrompt(expanded);
      clearInterval(stepTimer);
      if (data.status === 'partial_success' || data.status === 'fallback_skeleton' || data.partial) {
        const partial = normalizeAiPartialResponse(data);
        useAiFlowStore.getState().patch({
          error: partial.hasContext
            ? 'Частичный сценарий — откройте диагностику в legacy flow или упростите запрос.'
            : 'Partial IR без контекста',
        });
        return;
      }
      if (data.status === 'failed') {
        throw new Error(data.error || data.reason || 'Generation failed');
      }
      if (data.stacks?.length) {
        onApplyStacks?.(data.stacks, {
          templateMode: Boolean(data.meta?.deterministicTemplate),
          templateLabel: data.meta?.semanticTemplate,
          aiConfidenceLabel: data.aiConfidenceLabel,
        });
        onClose?.();
        useAiFlowStore.getState().patch({ studioOpen: false, prompt: '', plan: null });
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (e) {
      useAiFlowStore.getState().patch({ error: e.message });
    } finally {
      clearInterval(stepTimer);
      useAiFlowStore.getState().patch({ loading: false, loadingAction: null });
    }
  }, [prompt, canUseAi, onApplyStacks, onClose, onUpgrade]);

  if (!open) return null;

  const templates = getTemplatesByCategory(category);
  const ru = lang === 'ru';

  return (
    <div className="ai-studio-backdrop" onClick={() => !loading && onClose?.()}>
      <div className="ai-studio" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="AI Flow Studio">
        <header className="ai-studio__head">
          <div>
            <h2 className="ai-studio__title">
              <span className="ai-studio__spark">✨</span>
              {ru ? 'AI Flow Studio' : 'AI Flow Studio'}
            </h2>
            <p className="ai-studio__subtitle">
              {ru
                ? 'Опишите сценарий на естественном языке — получите готовый flow с узлами и связями'
                : 'Describe your bot in natural language — get a complete visual flow'}
            </p>
          </div>
          <button type="button" className="ai-studio__close" onClick={onClose} disabled={loading} aria-label="Close">×</button>
        </header>

        <nav className="ai-studio__tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`ai-studio__tab ${activeTab === t.id ? 'is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </nav>

        <div className="ai-studio__body">
          {activeTab === 'templates' && (
            <div className="ai-studio__templates">
              <div className="ai-studio__cat-row">
                <button
                  type="button"
                  className={`ai-studio__chip ${category === 'all' ? 'is-active' : ''}`}
                  onClick={() => setCategory('all')}
                >
                  Все
                </button>
                {PROMPT_TEMPLATE_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`ai-studio__chip ${category === c.id ? 'is-active' : ''}`}
                    onClick={() => setCategory(c.id)}
                  >
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
              <div className="ai-studio__template-grid">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="ai-studio__template-card"
                    onClick={() => {
                      setPrompt(t.prompt.slice(0, AI_PROMPT_MAX_CHARS));
                      setTab('generate');
                    }}
                  >
                    <strong>{t.title}</strong>
                    <span>{t.description}</span>
                  </button>
                ))}
              </div>
              <div className="ai-studio__flow-templates">
                <h4>Структура flow</h4>
                {FLOW_TEMPLATES.map((ft) => (
                  <div key={ft.id} className="ai-studio__flow-tpl">
                    <span>{ft.icon}</span>
                    <div>
                      <strong>{ft.name}</strong>
                      <span>{ft.nodes.join(' → ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(activeTab === 'generate' || activeTab === 'plan') && (
            <>
              <div className="ai-studio__prompt-wrap">
                <textarea
                  className="ai-studio__prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value.slice(0, AI_PROMPT_MAX_CHARS))}
                  placeholder={ru
                    ? 'Например: Сделай автоворонку для салона / Сделай onboarding flow'
                    : 'e.g. Build a salon booking funnel / Create onboarding flow'}
                  rows={5}
                  disabled={loading}
                />
                <div className="ai-studio__prompt-meta">
                  <span>{prompt.length}/{AI_PROMPT_MAX_CHARS}</span>
                </div>
              </div>

              {error && <div className="ai-studio__error" role="alert">{error}</div>}

              {plan && activeTab === 'plan' && (
                <div className="ai-studio__plan">
                  <h4>Структурированный план</h4>
                  <p className="ai-studio__plan-niche">Ниша: <code>{plan.niche}</code> · шаблон: {plan.suggestedTemplate}</p>
                  <ol className="ai-studio__sequence">
                    {(plan.sequence || []).map((step, i) => (
                      <li key={`${step.type}-${i}`}>
                        <span className="ai-studio__seq-type">{step.type}</span>
                        <span>{step.label}</span>
                      </li>
                    ))}
                  </ol>
                  <details className="ai-studio__expanded">
                    <summary>Расширенный prompt</summary>
                    <pre>{plan.expandedPrompt}</pre>
                  </details>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="ai-studio__foot">
          <button
            type="button"
            className="ai-studio__btn ai-studio__btn--ghost"
            onClick={runPlan}
            disabled={loading || !prompt.trim()}
          >
            {loading && useAiFlowStore.getState().loadingAction === 'plan' ? '…' : 'Preview plan'}
          </button>
          <button
            type="button"
            className="ai-studio__btn ai-studio__btn--primary"
            onClick={runGenerate}
            disabled={loading || prompt.trim().length < 5}
          >
            {loading && useAiFlowStore.getState().loadingAction === 'generate'
              ? `Generating… (${localStep + 1}/5)`
              : (ru ? 'Сгенерировать flow' : 'Generate flow')}
          </button>
        </footer>

        {loading && (
          <div className="ai-studio__loading-bar" aria-hidden>
            <div className="ai-studio__loading-fill" style={{ width: `${((localStep + 1) / 5) * 100}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
