import { useEffect, useCallback } from 'react';

/**
 * Global editor keyboard UX.
 * @param {object} opts
 */
export function useEditorKeyboard({
  enabled = true,
  onUndo,
  onRedo,
  onSave,
  onToggleFocus,
  onClosePanels,
  onOpenHelp,
  onOpenCommandPalette,
}) {
  const handler = useCallback((e) => {
    if (!enabled) return;
    const mod = e.ctrlKey || e.metaKey;
    const target = e.target;
    const typing = target instanceof HTMLElement && (
      target.isContentEditable
      || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
    );
    if (typing && e.key !== 'Escape') return;

    if (e.key === '?' && !mod) {
      e.preventDefault();
      onOpenHelp?.();
      return;
    }

    if (e.key === 'Escape') {
      onClosePanels?.();
      return;
    }

    if (e.key === 'f' && !mod && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      onToggleFocus?.();
      return;
    }

    if (mod && e.key === 'k') {
      e.preventDefault();
      onOpenCommandPalette?.();
      return;
    }

    if (mod && e.key === 'h' && !e.shiftKey) {
      e.preventDefault();
      window.dispatchEvent(new Event('cicada:toggle-history'));
      return;
    }

    if (mod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      onUndo?.();
      return;
    }

    if (mod && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      onRedo?.();
      return;
    }

    if (mod && e.key === 's') {
      e.preventDefault();
      onSave?.();
    }
  }, [enabled, onUndo, onRedo, onSave, onToggleFocus, onClosePanels, onOpenHelp, onOpenCommandPalette]);

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}
