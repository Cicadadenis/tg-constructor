/**
 * Auto-generate hook selectors from a zustand store for fine-grained subscriptions.
 *
 * @example
 * const useUiStore = create(...);
 * export const uiSelectors = createSelectors(useUiStore);
 * export const usePreviewPanelOpen = () => uiSelectors.use.previewPanelOpen();
 */

export function createSelectors(useStore) {
  const store = useStore;
  const state = store.getState();
  const selectors = {};

  for (const key of Object.keys(state)) {
    if (typeof state[key] === 'function') continue;
    selectors[key] = () => store((s) => s[key]);
  }

  return {
    use: selectors,
    get: () => {
      const snap = store.getState();
      const out = {};
      for (const k of Object.keys(selectors)) out[k] = snap[k];
      return out;
    },
  };
}
