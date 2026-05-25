# State architecture (Zustand + Immer)

## Modular stores

| Store | Domain |
|-------|--------|
| `uiStore` | Modals, panels, tour, toast, inspector chrome |
| `flowStore` | Project id/name, layout mode, cloud project list |
| `graphStore` | GraphDocument editor (class instance outside Immer) |
| `selectionStore` | Selected node, palette drag, repair highlights |
| `previewStore` | Simulator panel, bot run/stop, debug trace id |
| `historyStore` | Time-travel snapshots |
| `collaborationStore` | Presence, optimistic op queue (extensible) |
| `analyticsStore` | Analytics hub panel + snapshot cache |
| `persistenceStore` | Autosave / cloud save status |

## Patterns

- **Selectors**: `createSelectors(useUiStore)` + `useShallow` for object slices
- **Graph**: `useGraphRevision()` / `useCanvasProjection()` — avoid App-wide rerenders
- **Undo/redo**: `graphStore.undo()` / `redo()` (wraps `GraphEditorStore`)
- **Time-travel**: `historyStore.captureSnapshot()` + `travelTo(id)`
- **Autosave**: `useCanvasAutosave` + `persistenceStore.isLoading`

## Usage

```jsx
import { useEditorStoreBindings } from '../app/editorStoreBindings.js';
import ConnectedGraphCanvas from '../builder/ConnectedGraphCanvas.jsx';

// App
const { graph, graphRevision, selectedBlockId, setSelectedBlockId } = useEditorStoreBindings();

// Canvas without prop drilling
<ConnectedGraphCanvas onSelectNode={...} />
```

## DevTools

Zustand devtools enabled in `import.meta.env.DEV` via `createImmerStore`.
