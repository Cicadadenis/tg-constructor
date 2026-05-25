import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Collapsible inspector group — Notion-style, animated.
 */
export default function FlowInspectorSection({
  title,
  hint,
  defaultOpen = true,
  sticky = false,
  children,
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <section className={`fi-section${sticky ? ' fi-section--sticky' : ''}`}>
      <button
        type="button"
        className="fi-section__head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="fi-section__title">{title}</span>
        {hint && <span className="fi-section__hint">{hint}</span>}
        <span className="fi-section__chevron" aria-hidden>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d={open ? 'M3 5l3 3 3-3' : 'M5 3l3 3-3 3'}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="fi-section__body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="fi-section__inner">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
