/**
 * Isolated mock execution — preview worker + in-memory subscriber sandbox.
 * No Telegram API; safe for inspector live preview.
 */

/**
 * @param {object} params
 * @param {object} params.graphIR
 * @param {string} params.generatedPython
 * @param {string} [params.text]
 * @param {string|null} [params.callbackData]
 * @param {object|null} [params.event]
 * @param {ReadonlyArray} [params.palette]
 * @param {object} [params.paletteOptions]
 * @param {string} [params.flowId]
 * @param {string} [params.botId]
 */
export async function runMockFlowStep(params) {
  const { runDebugExecution } = await import('../constructor/previewBridge.js');
  return runDebugExecution({
    graphIR: params.graphIR,
    generatedPython: params.generatedPython,
    compileWarnings: params.compileWarnings ?? [],
    transpileTrace: params.transpileTrace ?? [],
    text: params.text != null ? String(params.text) : '',
    callbackData: params.callbackData ?? null,
    event: params.event ?? null,
    palette: params.palette ?? [],
    paletteOptions: params.paletteOptions ?? {},
    flowId: params.flowId,
    botId: params.botId,
  });
}
