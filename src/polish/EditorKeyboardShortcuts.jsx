import React, { useState } from 'react';
import { useAppLayout } from '../layout/AppLayoutContext.jsx';
import { useEditorKeyboard } from './useEditorKeyboard.js';
import KeyboardHelpModal from './KeyboardHelpModal.jsx';

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
  });

  return (
    <KeyboardHelpModal
      open={showHelp}
      onClose={() => setShowHelp(false)}
      lang={lang}
    />
  );
}
