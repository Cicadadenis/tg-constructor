import React from 'react';
import { usePersistenceStore } from '../stores/persistenceStore.js';
import './save-status-indicator.css';

/**
 * Autosave / cloud save status for the editor top bar.
 */
export default function SaveStatusIndicator({ lang = 'ru' }) {
  const isSaving = usePersistenceStore((s) => s.isSaving);
  const saveError = usePersistenceStore((s) => s.saveError);
  const pendingCloud = usePersistenceStore((s) => s.pendingCloudSave);
  const lastPersistedAt = usePersistenceStore((s) => s.lastPersistedAt);

  const copy = lang === 'en'
    ? { saving: 'Saving…', saved: 'Saved', pending: 'Unsaved changes', error: 'Save failed' }
    : lang === 'uk'
      ? { saving: 'Зберігаємо…', saved: 'Збережено', pending: 'Є незбережені зміни', error: 'Помилка збереження' }
      : { saving: 'Сохраняем…', saved: 'Сохранено', pending: 'Есть несохранённые изменения', error: 'Ошибка сохранения' };

  let state = 'idle';
  let label = copy.saved;
  if (saveError) {
    state = 'error';
    label = copy.error;
  } else if (isSaving) {
    state = 'saving';
    label = copy.saving;
  } else if (pendingCloud) {
    state = 'pending';
    label = copy.pending;
  }

  const timeHint = lastPersistedAt && state === 'idle' && !pendingCloud
    ? new Date(lastPersistedAt).toLocaleTimeString(
      lang === 'en' ? 'en-US' : lang === 'uk' ? 'uk-UA' : 'ru-RU',
      { hour: '2-digit', minute: '2-digit' },
    )
    : null;

  return (
    <div
      className={`save-status save-status--${state}`}
      role="status"
      aria-live="polite"
      title={timeHint ? `${label} · ${timeHint}` : label}
    >
      <span className="save-status__dot" aria-hidden />
      <span className="save-status__label">{label}</span>
      {timeHint && state === 'idle' && !saveError && (
        <span className="save-status__time">{timeHint}</span>
      )}
    </div>
  );
}
