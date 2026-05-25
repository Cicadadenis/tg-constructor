import React from 'react';
import './publish-status-indicator.css';

/**
 * Publish / deploy status for the editor top bar.
 * @param {object} props
 * @param {string} [props.lang]
 * @param {boolean} [props.busy]
 * @param {boolean} [props.success]
 * @param {() => void} [props.onPublish]
 */
export default function PublishStatusIndicator({
  lang = 'ru',
  busy = false,
  success = false,
  onPublish,
}) {
  const copy = lang === 'en'
    ? {
      draft: 'Draft',
      publishing: 'Publishing…',
      live: 'Published',
      action: 'Publish',
    }
    : lang === 'uk'
      ? {
        draft: 'Чернетка',
        publishing: 'Публікуємо…',
        live: 'Опубліковано',
        action: 'Опублікувати',
      }
      : {
        draft: 'Черновик',
        publishing: 'Публикуем…',
        live: 'Опубликовано',
        action: 'Опубликовать',
      };

  let state = 'draft';
  let label = copy.draft;
  if (busy) {
    state = 'publishing';
    label = copy.publishing;
  } else if (success) {
    state = 'live';
    label = copy.live;
  }

  const canPublish = Boolean(onPublish) && !busy && !success;

  return (
    <div
      className={`publish-status publish-status--${state}`}
      role="status"
      aria-live="polite"
    >
      {busy ? (
        <>
          <span className="publish-status__spinner" aria-hidden />
          <span>{label}</span>
        </>
      ) : (
        <>
          <span className="publish-status__dot" aria-hidden />
          {canPublish ? (
            <button
              type="button"
              className="publish-status__btn"
              onClick={onPublish}
              title={copy.action}
            >
              {copy.action}
            </button>
          ) : (
            <span>{label}</span>
          )}
        </>
      )}
    </div>
  );
}
