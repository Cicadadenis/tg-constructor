import React from 'react';
import { motion } from 'framer-motion';
import * as Tooltip from '@radix-ui/react-tooltip';
import { NAV_SECTIONS, sectionLabel } from '../appSections.js';
import { SidebarIcons } from './sidebarIcons.jsx';

/**
 * Vertical navigation — compact (icons) or expanded (icons + labels).
 */
export default function McSidebarNav({
  lang = 'ru',
  section,
  onSectionChange,
  compact = false,
  counts = {},
}) {
  return (
    <Tooltip.Provider delayDuration={280}>
      <nav
        className={`mc-sidebar-nav tw-flex-shrink-0${compact ? ' mc-sidebar-nav--compact' : ''}`}
        aria-label={lang === 'en' ? 'Workspace' : 'Рабочая область'}
      >
        {!compact && (
          <div className="mc-sidebar-nav__section-label">
            {lang === 'en' ? 'Sections' : lang === 'uk' ? 'Секції' : 'Разделы'}
          </div>
        )}
        <ul className="mc-sidebar-nav__list">
          {NAV_SECTIONS.map((entry) => {
            const active = section === entry.id;
            const count = counts[entry.id];
            const label = sectionLabel(lang, entry.id);
            const Icon = SidebarIcons[entry.id];

            const btn = (
              <button
                type="button"
                className={`mc-sidebar-nav__item${active ? ' mc-sidebar-nav__item--active' : ''}`}
                onClick={() => onSectionChange(entry.id)}
                aria-current={active ? 'page' : undefined}
              >
                <span className="mc-sidebar-nav__icon-wrap">
                  <span className="mc-sidebar-nav__icon">{Icon}</span>
                </span>
                {!compact && (
                  <span className="mc-sidebar-nav__label">{label}</span>
                )}
                {!compact && typeof count === 'number' && count > 0 && (
                  <span className="mc-sidebar-nav__badge">{count > 99 ? '99+' : count}</span>
                )}
                {active && (
                  <motion.span
                    layoutId="mc-sidebar-nav-indicator"
                    className="mc-sidebar-nav__indicator"
                    transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                  />
                )}
              </button>
            );

            return (
              <li key={entry.id}>
                {compact ? (
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>{btn}</Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content side="right" sideOffset={8} className="mc-sidebar-tooltip">
                        {label}
                        {typeof count === 'number' && count > 0 ? ` (${count})` : ''}
                        <Tooltip.Arrow className="mc-sidebar-tooltip__arrow" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                ) : (
                  btn
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </Tooltip.Provider>
  );
}
