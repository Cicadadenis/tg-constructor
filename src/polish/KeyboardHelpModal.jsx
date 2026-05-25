import React, { useEffect } from 'react';

const SHORTCUTS = {
  ru: [
    ['?', 'Справка по клавишам'],
    ['Esc', 'Закрыть панель / модалку'],
    ['Delete', 'Удалить выбранный узел'],
    ['Ctrl + Z', 'Отменить'],
    ['Ctrl + Shift + Z', 'Повторить'],
    ['Ctrl + S', 'Сохранить проект'],
    ['F', 'Режим фокуса на холсте'],
  ],
  en: [
    ['?', 'Keyboard shortcuts help'],
    ['Esc', 'Close panel / modal'],
    ['Delete', 'Delete selected node'],
    ['Ctrl + Z', 'Undo'],
    ['Ctrl + Shift + Z', 'Redo'],
    ['Ctrl + S', 'Save project'],
    ['F', 'Focus mode'],
  ],
};

export default function KeyboardHelpModal({ open, onClose, lang = 'ru' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const rows = SHORTCUTS[lang === 'en' ? 'en' : 'ru'];

  return (
    <div
      className="mc-kbd-help-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
    >
      <div className="mc-kbd-help" onClick={(e) => e.stopPropagation()}>
        <h3>{lang === 'en' ? 'Keyboard shortcuts' : 'Горячие клавиши'}</h3>
        <dl>
          {rows.map(([key, desc]) => (
            <React.Fragment key={key}>
              <dt><kbd>{key}</kbd></dt>
              <dd>{desc}</dd>
            </React.Fragment>
          ))}
        </dl>
        <button type="button" className="ds-btn ds-btn--primary ds-btn--sm" style={{ width: '100%', marginTop: 16 }} onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
}
