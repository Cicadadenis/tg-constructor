import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collapseVariants } from '../../motion/index.js';
import { SidebarIcons } from './sidebarIcons.jsx';

/**
 * Collapsible list group — favorites, recent, all flows.
 */
export default function McCollapsibleGroup({
  id,
  title,
  count = 0,
  collapsed = false,
  onToggle,
  children,
  action = null,
}) {
  return (
    <section className="mc-sidebar-group">
      <button
        type="button"
        className="mc-sidebar-group__head"
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        <span className={`mc-sidebar-group__chevron${collapsed ? ' mc-sidebar-group__chevron--closed' : ''}`}>
          {SidebarIcons.chevron}
        </span>
        <span className="mc-sidebar-group__title">{title}</span>
        {count > 0 && (
          <span className="mc-sidebar-group__count">{count}</span>
        )}
        {action}
      </button>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key={id}
            className="mc-sidebar-group__body"
            variants={collapseVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
