# Design system

ManyChat-inspired UI tokens and shared components for Cicada Studio.

## Tokens (`tokens.css`)

- **Surfaces:** `--color-bg`, `--color-surface`, `--color-border` (`#E5E7EB`)
- **Brand:** `--color-primary` (`#2563EB`) — single accent; no multi-color UI logic
- **Type:** Inter (`--font-sans`), 14px body, 24px H1, 18px H2, 13px meta
- **Spacing:** 8px grid — `--space-1` (8), `--space-2` (16), `--space-3` (24), `--space-4` (32)
- **Radius / shadow:** `--radius-sm|md|lg`, `--shadow-sm|md` (soft only)

Legacy aliases (`--bg`, `--accent`, `--text`, …) map to tokens for gradual migration.

## Components (`components.css`)

- `.ds-card`, `.ds-btn--primary|secondary|ghost|danger`
- `.ds-input`, `.ds-chip`, `.ds-panel-title`

## Usage

Imported globally via `src/index.css` → `design-system/index.css`.

Editor chrome: `editor-chrome.css` (toolbar `.tb-btn-*` aliases).  
Layout shell: `src/layout/editor-shell.css`.
