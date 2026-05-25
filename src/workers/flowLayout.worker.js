/**
 * Background flow layout — off main thread for large graphs.
 */
import { computeFlowBuilderPositions } from '../builder/flowLayout/flowBuilderLayout.js';

self.onmessage = (event) => {
  const { requestId, document, mode } = event.data || {};
  try {
    const { positions, mode: resolvedMode } = computeFlowBuilderPositions(document, mode);
    const serialized = [...positions.entries()];
    self.postMessage({
      requestId,
      ok: true,
      positions: serialized,
      mode: resolvedMode,
    });
  } catch (err) {
    self.postMessage({
      requestId,
      ok: false,
      error: String(err?.message || err),
    });
  }
};
