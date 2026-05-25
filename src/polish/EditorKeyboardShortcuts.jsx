import React, { useState, useEffect } from 'react';
import { useAppLayout } from '../layout/AppLayoutContext.jsx';
import { useEditorKeyboard } from './useEditorKeyboard.js';
import KeyboardHelpModal from './KeyboardHelpModal.jsx';
import { useEditorUx } from '../ux/EditorUxLayer.jsx';

/**
 * Keyboard UX inside AppLayoutProvider (focus mode, undo, save, help).
 */
export default function EditorKeyboardShortcuts({
  enabled = true,
  lang = 'ru',
  onUndo,
  onRedo,
  onSave,
  onClosePanels,
}) {
  const { toggleFocusMode } = useAppLayout();
  const [showHelp, setShowHelp] = useState(false);
  const editorUx = useEditorUx();

  useEditorKeyboard({
    enabled,
    onUndo,
    onRedo,
    onSave,
    onToggleFocus: toggleFocusMode,
    onClosePanels: () => {
      if (showHelp) {
        setShowHelp(false);
        return;
      }
      onClosePanels?.();
    },
    onOpenHelp: () => setShowHelp(true),
    onOpenCommandPalette: () => editorUx?.openPalette?.(),
  });

  useEffect(() => {
    const openHelp = () => setShowHelp(true);
    const toggleFocus = () => toggleFocusMode();
    window.addEventListener('cicada:open-keyboard-help', openHelp);
    window.addEventListener('cicada:toggle-focus', toggleFocus);
    return () => {
      window.removeEventListener('cicada:open-keyboard-help', openHelp);
      window.removeEventListener('cicada:toggle-focus', toggleFocus);
    };
  }, [toggleFocusMode]);

  return (
    <KeyboardHelpModal
      open={showHelp}
      onClose={() => setShowHelp(false)}
      lang={lang}
    />
  );
}
