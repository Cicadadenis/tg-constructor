import React, { useEffect, useRef, useState } from 'react';
import { channelIcon } from './flowListMeta.js';
import './flow-list-card.css';

/**
 * ManyChat-style flow row — channel, trigger, status, date, quick actions.
 */
export default function FlowListCard({
  item,
  active = false,
  selected = false,
  lang = 'ru',
  onSelect,
  onToggleSelect,
  onOpen,
  onDuplicate,
  onTest,
  onExport,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const status = item.status || 'active';
  const statusLabel = status === 'draft'
    ? (lang === 'en' ? 'Draft' : lang === 'uk' ? 'Чернетка' : 'Черновик')
    : (lang === 'en' ? 'Active' : lang === 'uk' ? 'Активний' : 'Активен');

  const menuLabel = lang === 'en' ? 'Flow actions' : lang === 'uk' ? 'Дії сценарію' : 'Действия со сценарием';
  const openLabel = lang === 'en' ? 'Open' : lang === 'uk' ? 'Відкрити' : 'Открыть';
  const dupLabel = lang === 'en' ? 'Duplicate' : lang === 'uk' ? 'Дублювати' : 'Дублировать';
  const testLabel = lang === 'en' ? 'Test' : lang === 'uk' ? 'Тест' : 'Тест';
  const exportLabel = lang === 'en' ? 'Export JSON' : lang === 'uk' ? 'Експорт JSON' : 'Экспорт JSON';

  const title = item.triggerLabel || item.name || item.id;
  const subtitle = item.triggerLabel && item.name && item.name !== item.triggerLabel
    ? item.name
    : null;

  return (
    <div
      className={[
        'flow-list-card',
        active ? 'flow-list-card--active' : '',
        selected ? 'flow-list-card--selected' : '',
      ].filter(Boolean).join(' ')}
    >
      <input
        type="checkbox"
        className="flow-list-card__check"
        checked={selected}
        onChange={() => onToggleSelect?.(item.id)}
        aria-label={item.name || item.id}
        onClick={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        className="flow-list-card__main"
        onClick={() => onSelect?.(item.id)}
      >
        <div className="flow-list-card__head">
          <span className="flow-list-card__channel" aria-hidden title="Telegram">
            {channelIcon(item.channel || 'telegram')}
          </span>
          <span className="flow-list-card__title">{title}</span>
          <span className={`flow-list-card__status flow-list-card__status--${status}`}>
            {statusLabel}
          </span>
        </div>
        {subtitle && (
          <span className="flow-list-card__subtitle">{subtitle}</span>
        )}
        <div className="flow-list-card__meta">
          {item.updatedAt && (
            <span className="flow-list-card__date">{item.updatedAt}</span>
          )}
          {typeof item.nodeCount === 'number' && item.nodeCount > 0 && (
            <span className="flow-list-card__steps">
              {lang === 'en'
                ? `${item.nodeCount} steps`
                : lang === 'uk'
                  ? `${item.nodeCount} кроків`
                  : `${item.nodeCount} шагов`}
            </span>
          )}
        </div>
      </button>
      <div className="flow-list-card__menu-wrap" ref={menuRef}>
        <button
          type="button"
          className="flow-list-card__menu-btn"
          aria-label={menuLabel}
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
        >
          ···
        </button>
        {menuOpen && (
          <div className="flow-list-card__menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onOpen?.(item.id); }}>
              {openLabel}
            </button>
            {onTest && (
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onTest?.(item.id); }}>
                {testLabel}
              </button>
            )}
            {onDuplicate && (
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDuplicate?.(item.id); }}>
                {dupLabel}
              </button>
            )}
            {onExport && item.id !== '__draft__' && (
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onExport?.(item.id); }}>
                {exportLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
