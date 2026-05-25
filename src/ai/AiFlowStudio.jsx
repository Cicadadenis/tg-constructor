import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAiFlowStore } from './aiFlowStore.js';
import {
  PROMPT_TEMPLATE_CATEGORIES,
  getTemplatesByCategory,
  AI_PROMPT_MAX_CHARS,
} from './promptTemplates.js';
import { getAiLabels } from './aiLabels.js';
import {
  planFlow,
  prepareFlowGeneration,
  generateFlowFromPrompt,
  buildStacksFromPromptAssist,
} from './aiFlowClient.js';
import { normalizeAiPartialResponse } from '../builder/BuilderComponents.jsx';
import './ai-flow-studio.css';

/**
 * Conversational AI-first flow generation — modern SaaS UX.
 */
export default function AiFlowStudio({
  open,
  onClose,
  onApplyStacks,
  canUseAi = true,
  onUpgrade,
  lang = 'ru',
}) {
  const {
    prompt,
    category,
    loading,
    error,
    plan,
    messages,
    activeTab,
  } = useAiFlowStore();

  const labels = useMemo(() => getAiLabels(lang), [lang]);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const setPrompt = (v) => useAiFlowStore.getState().patch({ prompt: v });
  const setCategory = (v) => useAiFlowStore.getState().patch({ category: v });
  const setTab = (v) => useAiFlowStore.getState().patch({ activeTab: v });

  useEffect(() => {
    if (!open) return;
    useAiFlowStore.getState().patch({ error: null });
    setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  const appendUser = useCallback((text) => {
    useAiFlowStore.getState().pushMessage({ role: 'user', content: text });
    setPrompt(text);
  }, []);

  const appendAssistant = useCallback((content, extra = {}) => {
    useAiFlowStore.getState().pushMessage({ role: 'assistant', content, ...extra });
  }, []);

  const runConversationalGenerate = useCallback(async (text) => {
    const q = String(text || prompt).trim();
    if (!q || q.length < 3) {
      useAiFlowStore.getState().patch({ error: lang === 'en' ? 'Describe your flow (min. 3 chars)' : 'Опишите сценарий (мин. 3 символа)' });
      return;
    }
    if (!canUseAi) {
      onUpgrade?.();
      return;
    }

    appendUser(q);
    useAiFlowStore.getState().patch({ loading: true, loadingAction: 'generate', error: null, plan: null });

    try {
      appendAssistant(labels.planning, { status: 'thinking' });
      const planRes = await planFlow(q);
      const structured = planRes.plan;
      useAiFlowStore.getState().patch({ plan: structured });

      const seqLines = (structured?.sequence || [])
        .map((s, i) => `${i + 1}. ${s.label || s.type} (${s.type})`)
        .join('\n');
      appendAssistant(
        `${labels.planReady}\n${seqLines || '—'}`,
        { status: 'plan', plan: structured },
      );

      appendAssistant(labels.generating, { status: 'thinking' });

      let stacks = null;
      let meta = {};
      let aiConfidenceLabel = null;

      try {
        const prep = await prepareFlowGeneration(q);
        const expanded = prep.expandedPrompt || q;
        const data = await generateFlowFromPrompt(expanded);
        if (data.status === 'partial_success' || data.status === 'fallback_skeleton' || data.partial) {
          const partial = normalizeAiPartialResponse(data);
          useAiFlowStore.getState().patch({
            error: partial.hasContext
              ? (lang === 'en' ? 'Partial flow — simplify the prompt or use Repair on canvas.' : 'Частичный сценарий — упростите запрос или «Починить» на холсте.')
              : 'Partial IR',
          });
          return;
        }
        if (data.status === 'failed') {
          throw new Error(data.error || data.reason || 'Generation failed');
        }
        if (data.stacks?.length) {
          stacks = data.stacks;
          meta = data.meta || {};
          aiConfidenceLabel = data.aiConfidenceLabel;
        }
      } catch (llmErr) {
        const fallback = await buildStacksFromPromptAssist(q);
        stacks = fallback.stacks;
        meta = { ...fallback.meta, fallbackReason: llmErr.message };
      }

      if (stacks?.length) {
        onApplyStacks?.(stacks, {
          templateMode: Boolean(meta?.deterministicTemplate),
          templateLabel: meta?.semanticTemplate || structured?.niche,
          aiConfidenceLabel,
          recoveryMode: Boolean(meta?.fallbackReason),
        });
        appendAssistant(labels.applied, { status: 'done' });
        useAiFlowStore.getState().patch({ studioOpen: false, prompt: '', plan: null, messages: [] });
        onClose?.();
      } else {
        throw new Error(lang === 'en' ? 'No flow generated' : 'Flow не сгенерирован');
      }
    } catch (e) {
      useAiFlowStore.getState().patch({ error: e.message });
      appendAssistant(`⚠ ${e.message}`, { status: 'error' });
    } finally {
      useAiFlowStore.getState().patch({ loading: false, loadingAction: null });
    }
  }, [
    prompt,
    canUseAi,
    onApplyStacks,
    onClose,
    onUpgrade,
    lang,
    labels,
    appendUser,
    appendAssistant,
  ]);

  const handleChip = (text) => {
    setPrompt(text);
    void runConversationalGenerate(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading) void runConversationalGenerate();
    }
  };

  if (!open) return null;

  const templates = getTemplatesByCategory(category);

  return (
    <div className="ai-studio-backdrop" onClick={() => !loading && onClose?.()}>
      <div className="ai-studio ai-studio--chat" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="AI Flow">
        <header className="ai-studio__head">
          <div>
            <h2 className="ai-studio__title">
              <span className="ai-studio__spark" aria-hidden>✨</span>
              {labels.studioTitle}
            </h2>
            <p className="ai-studio__subtitle">{labels.studioSubtitle}</p>
          </div>
          <button type="button" className="ai-studio__close" onClick={onClose} disabled={loading} aria-label="Close">×</button>
        </header>

        <div className="ai-studio__chips">
          {labels.chips.map((chip) => (
            <button
              key={chip}
              type="button"
              className="ai-studio__chip"
              disabled={loading}
              onClick={() => handleChip(chip)}
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="ai-studio__chat">
          {messages.length === 0 && (
            <div className="ai-studio__welcome">
              <p>{lang === 'en' ? 'Try a quick start or describe your bot below.' : 'Выберите пример или опишите бота ниже.'}</p>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`ai-studio__bubble ai-studio__bubble--${m.role}${m.status ? ` is-${m.status}` : ''}`}
            >
              <pre className="ai-studio__bubble-text">{m.content}</pre>
              {m.plan?.sequence?.length > 0 && m.status === 'plan' && (
                <ol className="ai-studio__seq-mini">
                  {m.plan.sequence.map((step, i) => (
                    <li key={`${step.type}-${i}`}>
                      <code>{step.type}</code> {step.label}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
          {loading && (
            <div className="ai-studio__bubble ai-studio__bubble--assistant is-thinking">
              <span className="ai-studio__typing" aria-hidden />
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {activeTab === 'templates' && (
          <div className="ai-studio__templates-inline">
            <div className="ai-studio__cat-row">
              <span className="ai-studio__templates-label">{labels.templates}</span>
              {PROMPT_TEMPLATE_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`ai-studio__chip ${category === c.id ? 'is-active' : ''}`}
                  onClick={() => setCategory(c.id)}
                >
                  {c.icon}
                </button>
              ))}
            </div>
            <div className="ai-studio__template-grid ai-studio__template-grid--compact">
              {templates.slice(0, 4).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="ai-studio__template-card"
                  onClick={() => handleChip(t.prompt.slice(0, AI_PROMPT_MAX_CHARS))}
                >
                  <strong>{t.title}</strong>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <div className="ai-studio__error" role="alert">{error}</div>}

        <footer className="ai-studio__composer">
          <textarea
            ref={inputRef}
            className="ai-studio__composer-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, AI_PROMPT_MAX_CHARS))}
            onKeyDown={handleKeyDown}
            placeholder={labels.placeholder}
            rows={2}
            disabled={loading}
          />
          <div className="ai-studio__composer-bar">
            <span className="ai-studio__prompt-meta">{prompt.length}/{AI_PROMPT_MAX_CHARS}</span>
            <button
              type="button"
              className="ai-studio__btn ai-studio__btn--ghost"
              onClick={() => setTab(activeTab === 'templates' ? 'generate' : 'templates')}
            >
              📋
            </button>
            <button
              type="button"
              className="ai-studio__btn ai-studio__btn--primary"
              onClick={() => runConversationalGenerate()}
              disabled={loading || prompt.trim().length < 3}
            >
              {loading ? '…' : labels.send}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
