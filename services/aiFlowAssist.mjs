/**
 * AI Flow Assist API — structured generation, suggestions, repair, copywriting.
 */

import { AI_FLOW_ASSIST_ACTIONS, AI_FLOW_PROMPT_MAX_CHARS } from '../core/ai/flowAssistConstants.mjs';
import { buildStructuredFlowPlan, expandFlowPrompt } from '../core/ai/flowIntentExtensions.mjs';
import {
  suggestFlowNodes,
  autocompleteFlowStep,
  buildOptimizationHints,
  repairFlowGraph,
  suggestFlowBranches,
  suggestCopywriting,
} from '../core/ai/flowAssistEngine.mjs';
import { detectFlowNiche } from '../core/ai/flowIntentExtensions.mjs';
import { buildStacksFromPrompt } from '../core/ai/flowPlanToStacks.mjs';
import { runGraphValidationPipeline } from '../src/constructor/graph_document/graph_validation_pipeline.js';

/**
 * @param {import('express').Express} app
 * @param {object} deps
 * @param {Function} deps.requireUserAuth
 * @param {Function} deps.isProUser
 * @param {Function} [deps.callGroq]
 */
export function mountAiFlowAssistRoutes(app, deps) {
  const { requireUserAuth, isProUser, callGroq } = deps;

  app.post('/api/ai/assist', requireUserAuth, async (req, res) => {
    try {
      const user = req.authUser || (await deps.findUserById?.(req.authUserId));
      if (!user) {
        return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
      }

      const action = String(req.body?.action || 'plan');
      if (!AI_FLOW_ASSIST_ACTIONS.includes(action)) {
        return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
      }

      const needsPro = ['copywriting'].includes(action);
      if (needsPro && !isProUser(user)) {
        return res.status(403).json({
          ok: false,
          error: 'PRO_REQUIRED',
          message: 'AI-функции доступны с подпиской PRO.',
        });
      }

      const document = req.body?.document || null;
      const nodeId = req.body?.nodeId ? String(req.body.nodeId) : null;
      const prompt = String(req.body?.prompt || '').trim();

      switch (action) {
        case 'plan': {
          if (prompt.length < 3) {
            return res.status(400).json({ ok: false, error: 'PROMPT_TOO_SHORT' });
          }
          if (prompt.length > AI_FLOW_PROMPT_MAX_CHARS) {
            return res.status(400).json({ ok: false, error: 'PROMPT_TOO_LONG' });
          }
          const plan = buildStructuredFlowPlan(prompt);
          return res.json({ ok: true, action, plan });
        }

        case 'generate': {
          if (prompt.length < 3) {
            return res.status(400).json({ ok: false, error: 'PROMPT_TOO_SHORT' });
          }
          const expandedPrompt = expandFlowPrompt(prompt).slice(0, AI_FLOW_PROMPT_MAX_CHARS);
          const plan = buildStructuredFlowPlan(prompt);
          const built = buildStacksFromPrompt(prompt, plan);
          return res.json({
            ok: true,
            action,
            expandedPrompt,
            plan,
            stacks: built.stacks,
            meta: built.meta,
            message: 'Используйте stacks локально или POST /api/ai-generate для LLM-сборки.',
          });
        }

        case 'build_stacks': {
          if (prompt.length < 3) {
            return res.status(400).json({ ok: false, error: 'PROMPT_TOO_SHORT' });
          }
          const plan = buildStructuredFlowPlan(prompt);
          const built = buildStacksFromPrompt(prompt, plan);
          return res.json({
            ok: true,
            action,
            plan,
            stacks: built.stacks,
            meta: built.meta,
          });
        }

        case 'suggest_nodes': {
          const suggestions = suggestFlowNodes(document, nodeId);
          return res.json({ ok: true, action, suggestions, nodeId });
        }

        case 'autocomplete': {
          const result = autocompleteFlowStep(document, nodeId);
          return res.json({ ok: true, action, ...result, nodeId });
        }

        case 'optimize': {
          const doc = document || { nodes: {}, edges: {} };
          const hints = buildOptimizationHints(doc);
          const validation = runGraphValidationPipeline(doc, { strict: false });
          return res.json({
            ok: true,
            action,
            hints,
            validationOk: validation.ok,
            validation,
          });
        }

        case 'repair': {
          const repair = repairFlowGraph(document || { nodes: {}, edges: {} });
          return res.json({ ok: true, action, repair });
        }

        case 'branches': {
          const branches = suggestFlowBranches(document || { nodes: {}, edges: {} }, nodeId);
          return res.json({ ok: true, action, ...branches });
        }

        case 'copywriting': {
          const text = String(req.body?.text || '').trim();
          const niche = detectFlowNiche(prompt || text);
          let result = suggestCopywriting(text, { niche, tone: req.body?.tone });

          if (callGroq && text.length >= 4) {
            try {
              const messages = [
                {
                  role: 'system',
                  content:
                    'Ты копирайтер Telegram-ботов. Верни только улучшенный текст сообщения (1-3 варианта через \\n), без пояснений.',
                },
                {
                  role: 'user',
                  content: `Ниша: ${niche}. Тон: ${req.body?.tone || 'friendly'}. Улучши текст:\n${text}`,
                },
              ];
              const data = await callGroq(messages, { max_tokens: 400, temperature: 0.4 });
              const raw = data?.choices?.[0]?.message?.content || '';
              const variants = raw.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3);
              if (variants.length) {
                result = { ...result, suggestion: variants[0], variants, source: 'llm' };
              }
            } catch {
              result = { ...result, source: 'rules' };
            }
          } else {
            result = { ...result, source: 'rules' };
          }
          return res.json({ ok: true, action, copywriting: result });
        }

        default:
          return res.status(400).json({ ok: false, error: 'UNKNOWN_ACTION' });
      }
    } catch (e) {
      console.error('[ai/assist]', e);
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });
}
