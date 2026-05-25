import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  paletteBackdropVariants,
  paletteSheetVariants,
  staggerContainer,
  staggerItem,
} from '../motion/index.js';
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
          variants={paletteBackdropVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            className="ux-palette"
            role="dialog"
            aria-modal="true"
            aria-label={lang === 'en' ? 'Command palette' : 'Палитра команд'}
            variants={paletteSheetVariants}
            initial="initial"
            animate="animate"
            exit="exit"
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
            <motion.ul
              className="ux-palette__list"
              role="listbox"
              variants={staggerContainer}
              initial="hidden"
              animate="show"
            >
              {filtered.length === 0 && (
                <li className="ux-palette__empty">{emptyLabel}</li>
              )}
              {filtered.map((cmd, i) => (
                <motion.li
                  key={cmd.id}
                  role="option"
                  aria-selected={i === activeIndex}
                  variants={staggerItem}
                  layout
                >
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
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
