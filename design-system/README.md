# MC Design System (ManyChat-style foundation)

Enterprise-grade **foundation layer** for Cicada Studio. Does not replace existing `src/design-system/*` or editor logic — opt-in via CSS classes (`mc-*`) and React primitives.

## Stack

- **CSS variables** (`--mc-*`) — tokens, light/dark themes
- **Tailwind** (`tw-` prefix, preflight off) — utilities mapped to tokens
- **Radix UI** — Modal (Dialog), Tooltip, Select, Button Slot
- **Framer Motion** — `motion/presets.js` (optional peer)

## Install

```bash
npm install -D tailwindcss@3.4 postcss autoprefixer
npm install @radix-ui/react-dialog @radix-ui/react-tooltip @radix-ui/react-select @radix-ui/react-slot clsx
```

## Usage

### CSS (already wired via `src/design-system/foundation.css`)

```html
<html data-mc-theme="light" data-mc-ds="on">
```

### React

```jsx
import { Button, Card, Panel, initMcDesignSystem } from '../../design-system/index.js';

initMcDesignSystem({ theme: 'light' });

<Button variant="primary">Save</Button>
<Card padding interactive>…</Card>
```

### Tailwind

```html
<div class="tw-bg-mc-canvas tw-rounded-mc-card tw-shadow-mc-sm" />
```

## Structure

```
design-system/
  tokens/          colors, spacing, type, radius, elevation, motion, z-index
  themes/          light, dark
  bridge/          legacy --color-* compat
  styles/          primitives, states, tailwind-entry
  motion/          presets.js, transitions.css
  react/primitives Button, Card, Panel, …
```

## Migration

1. Use `mc-btn` alongside `ds-btn` — no conflict.
2. `.editor-shell` / `body:has(.lp-page)` dark overrides still win on scoped trees.
3. Gradually adopt `NodeCard` vs `FlowNodeCard` on canvas.

## Accessibility

- `mc-focus-ring` + `:focus-visible`
- Radix focus trap in Modal/Select
- `aria-*` on Input, FloatingMenuItem
- `prefers-reduced-motion` in token motion.css
