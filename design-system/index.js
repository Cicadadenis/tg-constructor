/**
 * MC Design System — JS entry (primitives + motion presets).
 */

export * from './react/primitives/index.js';
export * from './motion/presets.js';

/** Apply light theme + foundation scope on document root */
export function initMcDesignSystem(options = {}) {
  const { theme = 'light', root = document.documentElement } = options;
  root.setAttribute('data-mc-theme', theme);
  root.setAttribute('data-mc-ds', 'on');
}
