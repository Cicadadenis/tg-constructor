/**
 * EngineClient — external execution service (GraphControlPlane via API).
 * UI never calls handle_update or NativeOps directly.
 */

import { apiFetch, resolveApiUrl } from '../apiClient.js';
import { assertUiImportAllowed } from './uiLayerGuard.js';

assertUiImportAllowed('constructor/engineClient');

const _traceSubscribers = new Map();

function platformBase() {
  const base = import.meta.env.VITE_PLATFORM_API_URL ?? '/api/platform';
  return String(base).replace(/\/$/, '');
}

export class EngineClient {
  constructor({ baseUrl } = {}) {
    this.baseUrl = baseUrl ?? platformBase();
  }

  /**
   * Run graph IR on external engine; returns LEVEL_0 trace (read-only).
   * @param {object} graphIR
   * @param {{ generatedPython?: string, compileWarnings?: string[], transpileTrace?: object[], event?: object }} params
   */
  async run(graphIR, { generatedPython, compileWarnings, transpileTrace, event } = {}) {
    const url = resolveApiUrl(`${this.baseUrl}/v1/constructor/graph/execute`);
    const data = await apiFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graph: graphIR,
        generated_python: generatedPython,
        compile_warnings: compileWarnings,
        transpile_trace: transpileTrace,
        event,
      }),
    });
    if (data.trace_id) {
      this._notifyTrace(data.trace_id, data);
    }
    return data;
  }

  /** @deprecated use run() */
  async runGraphIR(graphIR, opts) {
    return this.run(graphIR, opts);
  }

  async validateGraph(graphIR) {
    const url = resolveApiUrl(`${this.baseUrl}/v1/constructor/graph/validate`);
    return apiFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph: graphIR }),
    });
  }

  async fetchTrace(traceId) {
    const url = resolveApiUrl(`${this.baseUrl}/v1/constructor/trace/${encodeURIComponent(traceId)}`);
    return apiFetch(url);
  }

  subscribeTrace(traceId, listener) {
    if (!_traceSubscribers.has(traceId)) {
      _traceSubscribers.set(traceId, new Set());
    }
    _traceSubscribers.get(traceId).add(listener);
    return () => {
      _traceSubscribers.get(traceId)?.delete(listener);
    };
  }

  _notifyTrace(traceId, payload) {
    const set = _traceSubscribers.get(traceId);
    if (!set) return;
    for (const fn of set) {
      fn(payload);
    }
  }

  async compileDsl() {
    throw new Error('DSL compile path removed. Use run(graphIR) with GraphDocument-derived IR.');
  }
}

export const defaultEngineClient = new EngineClient();
