/**
 * Staggered outbound playback — typing indicator + delay simulation (ManyChat-style).
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {object} opts
 * @param {ReadonlyArray} opts.entries - from previewOutboundToEntries
 * @param {boolean} [opts.simulateTyping=true]
 * @param {boolean} [opts.simulateDelays=true]
 * @param {number} [opts.typingMs=900]
 * @param {number} [opts.betweenMessagesMs=280]
 * @param {(entry: object) => void} opts.onShow
 * @param {(show: boolean) => void} [opts.onTyping]
 * @param {AbortSignal} [opts.signal]
 */
export async function playOutboundEntries({
  entries,
  simulateTyping = true,
  simulateDelays = true,
  typingMs = 900,
  betweenMessagesMs = 280,
  onShow,
  onTyping,
  signal,
}) {
  const list = entries || [];
  let firstBot = true;

  for (const entry of list) {
    if (signal?.aborted) return;

    if (entry.kind === 'typing_marker') {
      if (simulateTyping && onTyping) {
        onTyping(true);
        await sleep(Math.min(4000, Math.max(200, (entry.seconds || 1) * 1000)));
        if (signal?.aborted) return;
        onTyping(false);
      }
      continue;
    }

    if (entry.kind === 'delay_marker') {
      if (simulateDelays) {
        await sleep(Math.min(8000, Math.max(100, (entry.seconds || 1) * 1000)));
      }
      continue;
    }

    const isBot = entry.role === 'bot';
    if (isBot && simulateTyping && onTyping) {
      const ms = firstBot ? typingMs : Math.min(typingMs, 600);
      firstBot = false;
      onTyping(true);
      await sleep(ms);
      if (signal?.aborted) return;
      onTyping(false);
    }

    onShow({ ...entry, ts: Date.now() });
    if (isBot && betweenMessagesMs > 0) {
      await sleep(betweenMessagesMs);
    }
  }
}
