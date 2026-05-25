import React from 'react';
import { motion } from 'framer-motion';
import { interactiveMotion } from '../../motion/index.js';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { buildFlowCardViewModel } from '../flowCardModel.js';
import ChannelBadge from './ChannelBadge.jsx';
import './mc-flow-cards.css';


/**
 * Premium flow card — ManyChat / Notion database row density.
 */
export default function McFlowCard({
  item,
  lang = 'ru',
  active = false,
  favorite = false,
  selected = false,
  showCheckbox = false,
  onSelect,
  onToggleSelect,
  onToggleFavorite,
  onTest,
  onDuplicate,
  onExport,
  onArchive,
  onQuickEdit,
}) {
  const vm = buildFlowCardViewModel(item, lang);

  const t = lang === 'en'
    ? {
      menu: 'Flow actions',
      test: 'Test',
      edit: 'Edit',
      duplicate: 'Duplicate',
      export: 'Export JSON',
      archive: 'Archive',
      favorite: 'Favorite',
      analytics: 'Interactions',
      steps: 'steps',
    }
    : lang === 'uk'
      ? {
        menu: 'Дії',
        test: 'Тест',
        edit: 'Редагувати',
        duplicate: 'Дублювати',
        export: 'Експорт JSON',
        archive: 'В архів',
        favorite: 'Обране',
        analytics: 'Взаємодії',
        steps: 'кроків',
      }
      : {
        menu: 'Действия',
        test: 'Тест',
        edit: 'Изменить',
        duplicate: 'Дублировать',
        export: 'Экспорт JSON',
        archive: 'В архив',
        favorite: 'Избранное',
        analytics: 'События',
        steps: 'шагов',
      };

  const closeMenu = () => {};

  return (
    <motion.article
      className={[
        'mc-flow-card',
        active ? 'mc-flow-card--active' : '',
        selected ? 'mc-flow-card--selected' : '',
        `mc-flow-card--${vm.status}`,
      ].filter(Boolean).join(' ')}
      layout
      {...interactiveMotion}
    >
      {showCheckbox && (
        <input
          type="checkbox"
          className="mc-flow-card__check"
          checked={selected}
          onChange={() => onToggleSelect?.(item.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={vm.title}
        />
      )}

      <button
        type="button"
        className="mc-flow-card__hit"
        onClick={() => onSelect?.(item.id)}
      >
        <div className="mc-flow-card__icon" aria-hidden>
          <span className="mc-flow-card__icon-glyph">{vm.triggerIcon}</span>
        </div>

        <div className="mc-flow-card__body">
          <div className="mc-flow-card__row mc-flow-card__row--title">
            <h3 className="mc-flow-card__title">{vm.title}</h3>
            <span className={`mc-flow-card__status mc-flow-card__status--${vm.status}`}>
              {vm.statusLabel}
            </span>
          </div>

          <p className="mc-flow-card__desc">{vm.description}</p>

          <div className="mc-flow-card__row mc-flow-card__row--meta">
            <span className="mc-flow-card__trigger">
              <span className="mc-flow-card__trigger-label">{vm.triggerLabel}</span>
            </span>
            <ChannelBadge channel={item.channel || 'telegram'} />
            {vm.updatedRelative && (
              <time className="mc-flow-card__time" dateTime={item.updatedAtIso || undefined}>
                {vm.updatedRelative}
              </time>
            )}
          </div>

          <div className="mc-flow-card__row mc-flow-card__row--badges">
            {vm.nodeCount > 0 && (
              <span className="mc-flow-card__mini-badge mc-flow-card__mini-badge--neutral">
                {vm.nodeCount} {t.steps}
              </span>
            )}
            {vm.analyticsLabel ? (
              <span className="mc-flow-card__mini-badge mc-flow-card__mini-badge--accent" title={t.analytics}>
                <span aria-hidden>📊</span>
                {vm.analyticsLabel}
              </span>
            ) : vm.status === 'active' ? (
              <span className="mc-flow-card__mini-badge mc-flow-card__mini-badge--live">
                <span className="mc-flow-card__live-dot" aria-hidden />
                Live
              </span>
            ) : null}
          </div>
        </div>
      </button>

      <div className="mc-flow-card__actions">
        <div className="mc-flow-card__hover-actions" aria-hidden>
          <button
            type="button"
            className="mc-flow-card__action-btn"
            title={t.test}
            onClick={(e) => { e.stopPropagation(); onTest?.(item.id); }}
          >
            ▶
          </button>
          <button
            type="button"
            className="mc-flow-card__action-btn"
            title={t.edit}
            onClick={(e) => { e.stopPropagation(); onQuickEdit?.(item.id); }}
          >
            ✎
          </button>
          <button
            type="button"
            className="mc-flow-card__action-btn"
            title={t.duplicate}
            onClick={(e) => { e.stopPropagation(); onDuplicate?.(item.id); }}
          >
            ⧉
          </button>
        </div>

        <button
          type="button"
          className={`mc-flow-card__star${favorite ? ' mc-flow-card__star--on' : ''}`}
          aria-label={t.favorite}
          aria-pressed={favorite}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite?.(item.id);
          }}
        >
          ★
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="mc-flow-card__menu-btn"
              aria-label={t.menu}
              onClick={(e) => e.stopPropagation()}
            >
              ···
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="mc-flow-card__dropdown"
              sideOffset={6}
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu.Item className="mc-flow-card__dropdown-item" onSelect={() => { closeMenu(); onQuickEdit?.(item.id); }}>
                {t.edit}
              </DropdownMenu.Item>
              <DropdownMenu.Item className="mc-flow-card__dropdown-item" onSelect={() => { closeMenu(); onTest?.(item.id); }}>
                {t.test}
              </DropdownMenu.Item>
              <DropdownMenu.Item className="mc-flow-card__dropdown-item" onSelect={() => { closeMenu(); onDuplicate?.(item.id); }}>
                {t.duplicate}
              </DropdownMenu.Item>
              {item.id !== '__draft__' && (
                <DropdownMenu.Item className="mc-flow-card__dropdown-item" onSelect={() => { closeMenu(); onExport?.(item.id); }}>
                  {t.export}
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Separator className="mc-flow-card__dropdown-sep" />
              <DropdownMenu.Item
                className="mc-flow-card__dropdown-item mc-flow-card__dropdown-item--muted"
                onSelect={() => { closeMenu(); onArchive?.(item.id); }}
              >
                {t.archive}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </motion.article>
  );
}
