/**
 * LLM streaming helpers: partial Bot Intent Plan → compiled Bot IR snapshot.
 * AI must never emit stacks, React Flow nodes, or raw Canonical IR.
 */

import { normalizeAiCanonicalIr } from './aiCanonicalIr.mjs';
import {
  BOT_INTENT_PLAN_VERSION,
  BOT_INTENT_PLAN_VERSION_LEGACY,
  extractBotIntentPlanFromRaw,
} from './botIntentPlan.mjs';
import { compileIntentPlanToBotIr } from './intentToBotIr.mjs';

function parseJsonMaybe(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function completePartialJsonObject(raw) {
  const source = String(raw || '').trim();
  if (!source || source[0] !== '{') return null;
  let out = source;
  const stack = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if ((ch === '}' || ch === ']') && stack[stack.length - 1] === ch) stack.pop();
    if (stack.length === 0 && out.trim().endsWith('}')) break;
  }
  if (!out.trim()) return null;
  if (escaped) out = out.slice(0, -1);
  if (inString) out += '"';
  out = out.replace(/,\s*$/g, '');
  while (stack.length > 0) {
    const closer = stack.pop();
    out = out.replace(/,\s*$/g, '');
    out += closer;
  }
  return out;
}

function unwrapIntentPlanPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if ([BOT_INTENT_PLAN_VERSION, BOT_INTENT_PLAN_VERSION_LEGACY].includes(Number(value.intentPlanVersion))) {
    return value;
  }
  if (value.botIntentPlan && typeof value.botIntentPlan === 'object') {
    return unwrapIntentPlanPayload(value.botIntentPlan);
  }
  if (value.intentPlan && typeof value.intentPlan === 'object') {
    return unwrapIntentPlanPayload(value.intentPlan);
  }
  if (value.plan && typeof value.plan === 'object') {
    return unwrapIntentPlanPayload(value.plan);
  }
  return null;
}

/**
 * Compile partial/full LLM text to Bot IR only when it contains Bot Intent Plan JSON.
 * Rejects legacy stacks and Canonical IR emitted directly by the model.
 */
export function extractPartialBotIrFromLlmStream(raw, deterministicPlan = null) {
  const intentExtracted = extractBotIntentPlanFromRaw(raw);
  if (intentExtracted?.plan) {
    try {
      return normalizeAiCanonicalIr(compileIntentPlanToBotIr(intentExtracted.plan, deterministicPlan));
    } catch {
      return null;
    }
  }

  const completed = completePartialJsonObject(raw);
  const parsed = parseJsonMaybe(completed);
  if (!parsed || typeof parsed !== 'object') return null;

  const unwrapped = unwrapIntentPlanPayload(
    parsed.botIntentPlan || parsed.intentPlan || parsed.plan || parsed,
  );
  if (!unwrapped) return null;

  try {
    return normalizeAiCanonicalIr(compileIntentPlanToBotIr(unwrapped, deterministicPlan));
  } catch {
    return null;
  }
}

export function buildIntentPlanLlmMessages({
  systemPrompt,
  coreAppendix,
  intentPlanContext,
  astPolicyAppendix,
  userPrompt,
  fewShots = [],
}) {
  const messages = [{ role: 'system', content: systemPrompt + coreAppendix + intentPlanContext + astPolicyAppendix }];
  for (const shot of fewShots) {
    messages.push({ role: 'user', content: shot.user });
    messages.push({ role: 'assistant', content: shot.assistant });
  }
  messages.push({ role: 'user', content: userPrompt });
  return messages;
}
