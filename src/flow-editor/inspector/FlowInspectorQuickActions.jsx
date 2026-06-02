import React from 'react';

export default function FlowInspectorQuickActions({
  lang = 'ru',
  canSave = true,
  canDuplicate = true,
  canDelete = true,
  onSave,
  onDuplicate,
  onDelete,
}) {
  const t = lang === 'en'
    ? { save: 'Save', duplicate: 'Duplicate', delete: 'Delete' }
    : lang === 'uk'
      ? { save: 'Зберегти', duplicate: 'Дублювати', delete: 'Видалити' }
      : { save: 'Сохранить', duplicate: 'Дублировать', delete: 'Удалить' };

  return (
    <div className="fi-quick-actions">
      {canSave && onSave && (
        <button
          type="button"
          className="fi-quick-actions__btn fi-quick-actions__btn--primary"
          onClick={onSave}
          title={t.save}
        >
          {t.save}
        </button>
      )}
      {canDuplicate && onDuplicate && (
        <button
          type="button"
          className="fi-quick-actions__btn"
          onClick={onDuplicate}
          title={t.duplicate}
        >
          ⧉ {t.duplicate}
        </button>
      )}
      {canDelete && onDelete && (
        <button
          type="button"
          className="fi-quick-actions__btn fi-quick-actions__btn--danger"
          onClick={onDelete}
          title={t.delete}
        >
          🗑 {t.delete}
        </button>
      )}
    </div>
  );
}
