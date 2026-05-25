import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGraphStore } from '../stores/graphStore.js';
import CommandPalette from './CommandPalette.jsx';
import { buildCommandPaletteCommands } from './buildCommandPaletteCommands.js';
import './ux-interactions.css';

const EditorUxContext = React.createContext(null);

/**
 * Global editor UX — command palette + shared interaction wiring.
 */
export default function EditorUxLayer({
  lang = 'ru',
  enabled = true,
  graphHistory,
  onUndo,
  onRedo,
  onSave,
  onToggleFocus,
  onFitCanvas,
  onOpenHelp,
  onTestFlow,
  onAddMessage,
  onAddCondition,
  onDuplicateSelection,
  onDeleteSelection,
  onGroupSelection,
  setAppSection,
  onToggleHistory,
  children,
  canvasUxRef,
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  useEffect(() => {
    const open = () => setPaletteOpen(true);
    window.addEventListener('cicada:open-command-palette', open);
    return () => window.removeEventListener('cicada:open-command-palette', open);
  }, []);

  const commands = useMemo(() => buildCommandPaletteCommands({
    lang,
    canUndo: graphHistory?.canUndo,
    canRedo: graphHistory?.canRedo,
    onUndo,
    onRedo,
    onSave,
    onToggleFocus,
    onFitCanvas: onFitCanvas || (() => canvasUxRef?.current?.fit?.()),
    onOpenHelp,
    onToggleHistory,
    onAddMessage,
    onAddCondition,
    onTestFlow,
    onDuplicateSelection,
    onDeleteSelection,
    onGroupSelection,
    setAppSection,
  }), [
    lang, graphHistory, onUndo, onRedo, onSave, onToggleFocus, onFitCanvas,
    onOpenHelp, onTestFlow, onAddMessage, onAddCondition, onDuplicateSelection,
    onDeleteSelection, onGroupSelection, setAppSection, onToggleHistory, canvasUxRef,
  ]);

  const api = useMemo(() => ({
    openPalette,
    closePalette,
    paletteOpen,
  }), [openPalette, closePalette, paletteOpen]);

  return (
    <EditorUxContext.Provider value={api}>
      {children}
      {enabled && (
        <CommandPalette
          open={paletteOpen}
          onClose={closePalette}
          commands={commands}
          lang={lang}
        />
      )}
    </EditorUxContext.Provider>
  );
}

export function useEditorUx() {
  return React.useContext(EditorUxContext);
}
