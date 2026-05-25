import React from 'react';

/**
 * Primary global actions — always visible at top of left control panel.
 * @param {object} props
 * @param {string} [props.lang]
 * @param {() => void} props.onCreateFlow
 * @param {() => void} props.onPreview
 * @param {() => void} props.onPublish
 * @param {() => void} props.onTest
 * @param {() => void} [props.onStopTest]
 * @param {boolean} [props.previewActive]
 * @param {boolean} [props.testRunning]
 * @param {boolean} [props.canTest]
 * @param {boolean} [props.publishBusy]
 * @param {boolean} [props.testBusy]
 */
export default function GlobalActionsBar({
  lang = 'ru',
  onCreateFlow,
  onPreview,
  onPublish,
  onTest,
  onStopTest,
  previewActive = false,
  testRunning = false,
  canTest = true,
  publishBusy = false,
  testBusy = false,
}) {
  const t = lang === 'en'
    ? {
      create: 'Create Flow',
      preview: 'Preview',
      publish: 'Publish',
      test: 'Test',
      stop: 'Stop',
    }
    : lang === 'uk'
      ? {
        create: 'Створити flow',
        preview: 'Перегляд',
        publish: 'Опублікувати',
        test: 'Тест',
        stop: 'Стоп',
      }
      : {
        create: 'Создать сценарий',
        preview: 'Превью',
        publish: 'Опубликовать',
        test: 'Тест',
        stop: 'Стоп',
      };

  return (
    <div className="global-actions" role="toolbar" aria-label={lang === 'en' ? 'Global actions' : 'Главные действия'}>
      <button
        type="button"
        className="global-actions__btn global-actions__btn--primary"
        onClick={onCreateFlow}
      >
        <span className="global-actions__icon" aria-hidden>+</span>
        {t.create}
      </button>
      <button
        type="button"
        className={`global-actions__btn global-actions__btn--secondary${previewActive ? ' global-actions__btn--active' : ''}`}
        onClick={onPreview}
        aria-pressed={previewActive}
      >
        <span className="global-actions__icon" aria-hidden>▶</span>
        {t.preview}
      </button>
      <button
        type="button"
        className={`global-actions__btn global-actions__btn--secondary${publishBusy ? ' global-actions__btn--loading' : ''}`}
        onClick={onPublish}
        disabled={publishBusy}
        aria-busy={publishBusy}
      >
        {publishBusy ? (
          <span className="global-actions__spinner" aria-hidden />
        ) : (
          <span className="global-actions__icon" aria-hidden>↑</span>
        )}
        {publishBusy ? (lang === 'en' ? 'Publishing…' : lang === 'uk' ? 'Публікуємо…' : 'Публикуем…') : t.publish}
      </button>
      <button
        type="button"
        className={`global-actions__btn global-actions__btn--accent${testRunning ? ' global-actions__btn--running' : ''}`}
        onClick={testRunning ? onStopTest : onTest}
        disabled={!canTest && !testRunning}
        aria-pressed={testRunning}
      >
        <span className="global-actions__icon" aria-hidden>{testRunning ? '■' : '⚡'}</span>
        {testBusy ? '…' : (testRunning ? t.stop : t.test)}
      </button>
    </div>
  );
}
