/**
 * Lightweight event bus for realtime simulator UI updates (isolated from App state).
 */

export function createSimulatorEventBus() {
  const listeners = new Map();

  const on = (type, fn) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
    return () => listeners.get(type)?.delete(fn);
  };

  const onAny = (fn) => on('*', fn);

  const emit = (type, payload) => {
    listeners.get(type)?.forEach((fn) => {
      try { fn(payload); } catch { /* ignore */ }
    });
    listeners.get('*')?.forEach((fn) => {
      try { fn({ type, payload }); } catch { /* ignore */ }
    });
  };

  return { on, onAny, emit };
}

export const SimulatorEventTypes = Object.freeze({
  STEP_START: 'step:start',
  STEP_END: 'step:end',
  MESSAGE_ADD: 'message:add',
  TYPING: 'typing',
  VARIABLES: 'variables',
  ACTIVE_NODE: 'active_node',
  EXECUTION_PATH: 'execution_path',
  SUBSCRIBER: 'subscriber',
  REPLAY: 'replay',
  RESET: 'reset',
  ERROR: 'error',
  BRANCH: 'branch',
});
