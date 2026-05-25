# Canvas performance (production SaaS)

## Features

| # | Feature | Module |
|---|---------|--------|
| 1 | Virtualized rendering | React Flow `onlyRenderVisibleElements` (>48 nodes) + viewport cull |
| 2 | Memoized nodes | `VisualNodeCard` + `mergeProjectionNodes` ref preservation |
| 3 | Memoized edges | `React.memo` on edge components |
| 4 | Incremental updates | `projectionSync.js` visual key diff |
| 5 | Batched state updates | `batchedUpdates.js`, `graphStore.dispatchBatch` |
| 6 | Lazy rendering | `zoomTier` + `lazyRender` off-screen nodes |
| 7 | Web workers | `flowLayout.worker.js` (≥36 nodes) |
| 8 | Incremental compilation | `incrementalCompile.js` revision cache |
| 9 | Background layout | worker + `dispatchBatch` for moves |
| 10 | React profiling | `Profiler` + `renderDiagnostics.js` |

## Monitoring

- **FPS overlay** — auto in dev; production: `window.__CICADA_PERF__ = true`
- **Metrics**: FPS, zoom tier, node/edge count, sync counts, skipped syncs, layout ms
- Toggle: click ✕ on overlay or `usePerformanceStore.getState().toggleOverlay()`

## Zoom / drag / selection

- **Zoom**: LOD tiers (`full` / `compact` / `minimal`) — less motion & body detail when zoomed out
- **Drag**: `draggingRef` skips projection sync during drag; batched viewport persist
- **Selection**: `mergeSelectionOnNodes` fast path — no full graph resync

## API

```js
import { scheduleBatched } from './performance/batchedUpdates.js';
import { getIncrementalCompileSnapshot } from './performance/incrementalCompile.js';
import { computeLayoutInWorker } from './performance/layoutWorkerClient.js';
```
