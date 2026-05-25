/**
 * AI Flow Assist API client.
 */

import { resolveApiUrl } from '../apiClient.js';
import { getCsrfTokenForRequest } from '../csrf.js';

/**
 * @param {object} body
 */
export async function callAiAssist(body) {
  const token = await getCsrfTokenForRequest(resolveApiUrl('/api/ai/assist'));
  const res = await fetch(resolveApiUrl('/api/ai/assist'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': token,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `AI assist ${res.status}`);
  }
  return data;
}

export async function planFlow(prompt) {
  return callAiAssist({ action: 'plan', prompt });
}

export async function prepareFlowGeneration(prompt) {
  return callAiAssist({ action: 'generate', prompt });
}

export async function suggestNodes(document, nodeId) {
  return callAiAssist({ action: 'suggest_nodes', document, nodeId });
}

export async function autocompleteFlow(document, nodeId) {
  return callAiAssist({ action: 'autocomplete', document, nodeId });
}

export async function optimizeFlow(document) {
  return callAiAssist({ action: 'optimize', document });
}

export async function repairFlow(document) {
  return callAiAssist({ action: 'repair', document });
}

export async function copywritingAssist(text, { prompt = '', tone = 'friendly' } = {}) {
  return callAiAssist({ action: 'copywriting', text, prompt, tone });
}

export async function suggestBranches(document, nodeId) {
  return callAiAssist({ action: 'branches', document, nodeId });
}

/**
 * Full generation via existing endpoint.
 * @param {string} prompt
 */
export async function generateFlowFromPrompt(prompt) {
  const token = await getCsrfTokenForRequest(resolveApiUrl('/api/ai-generate'));
  const res = await fetch(resolveApiUrl('/api/ai-generate'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': token,
    },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `Ошибка ${res.status}`;
    try { msg = JSON.parse(text).error || msg; } catch { /* */ }
    throw new Error(msg);
  }
  return res.json();
}
