import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { filterCommands } from './buildCommandPaletteCommands.js';

/**
 * Raycast-style command palette (⌘K).
 */
export default function CommandPalette({
  open,
  onClose,
  commands = [],
  lang = 'ru',
}) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const filtered = useMemo(
    () => filterCommands(commands, query).filter((c) => !c.disabled),
    [commands, query],
  );

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
      return;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const runCommand = (cmd) => {
    onClose?.();
    requestAnimationFrame(() => cmd?.run?.());
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && filtered[activeIndex]) {
        e.preventDefault();
        runCommand(filtered[activeIndex]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, activeIndex, onClose]);

  const placeholder = lang === 'en' ? 'Search commands…' : 'Поиск команд…';
  const emptyLabel = lang === 'en' ? 'No commands' : 'Нет команд';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="ux-palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            className="ux-palette"
            role="dialog"
            aria-modal="true"
            aria-label={lang === 'en' ? 'Command palette' : 'Палитра команд'}
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ux-palette__search">
              <span className="ux-palette__search-icon" aria-hidden>⌘</span>
              <input
                ref={inputRef}
                type="search"
                className="ux-palette__input"
                placeholder={placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <ul className="ux-palette__list" role="listbox">
              {filtered.length === 0 && (
                <li className="ux-palette__empty">{emptyLabel}</li>
              )}
              {filtered.map((cmd, i) => (
                <li key={cmd.id} role="option" aria-selected={i === activeIndex}>
                  <button
                    type="button"
                    className={`ux-palette__item${i === activeIndex ? ' ux-palette__item--active' : ''}`}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => runCommand(cmd)}
                  >
                    <span className="ux-palette__item-label">{cmd.label}</span>
                    {cmd.shortcut && (
                      <kbd className="ux-palette__item-kbd">{cmd.shortcut}</kbd>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
