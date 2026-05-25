import React, { useState } from 'react';

const SLIDES = {
  ru: [
    {
      title: 'Добро пожаловать в Cicada',
      subtitle: 'Конструктор автоматизаций уровня ManyChat — визуальный flow, без кода.',
      steps: [
        { n: 1, title: 'Выберите шаблон', text: 'Welcome, Shop, Support или AI — один клик на холсте.' },
        { n: 2, title: 'Соберите сценарий', text: 'Перетаскивайте блоки, связывайте узлы, настраивайте в инспекторе.' },
        { n: 3, title: 'Запустите и тестируйте', text: 'Preview в симуляторе, затем публикация на сервер.' },
      ],
    },
  ],
  en: [
    {
      title: 'Welcome to Cicada',
      subtitle: 'ManyChat-grade automation builder — visual flows, no code.',
      steps: [
        { n: 1, title: 'Pick a template', text: 'Welcome, Shop, Support or AI — one click on the canvas.' },
        { n: 2, title: 'Build your flow', text: 'Drag blocks, connect nodes, tune props in the inspector.' },
        { n: 3, title: 'Test & publish', text: 'Preview in the simulator, then deploy to production.' },
      ],
    },
  ],
};

/**
 * First-run product onboarding (before spotlight tour).
 */
export default function ProductWelcome({
  open,
  onClose,
  onStartTour,
  lang = 'ru',
  storageKey,
}) {
  const [slide, setSlide] = useState(0);
  const copy = SLIDES[lang === 'en' ? 'en' : 'ru'][0];
  const isLast = slide >= copy.steps.length - 1;

  const finish = (startTour = false) => {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, '1');
      } catch { /* ignore */ }
    }
    onClose?.();
    if (startTour) onStartTour?.();
  };

  if (!open) return null;

  return (
    <div
      className="mc-welcome-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mc-welcome-title"
      onClick={() => finish(false)}
    >
      <div className="mc-welcome" onClick={(e) => e.stopPropagation()}>
        <div className="mc-welcome__hero">
          <div className="mc-welcome__logo" aria-hidden>✨</div>
          <h2 id="mc-welcome-title" className="mc-welcome__title">{copy.title}</h2>
          <p className="mc-welcome__subtitle">{copy.subtitle}</p>
        </div>

        <div className="mc-welcome__dots" role="tablist">
          {copy.steps.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === slide}
              className={`mc-welcome__dot ${i === slide ? 'is-active' : ''}`}
              onClick={() => setSlide(i)}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>

        <div className="mc-welcome__steps">
          {copy.steps.map((s, i) => (
            <div
              key={s.n}
              className="mc-welcome__step"
              hidden={i !== slide}
              style={i === slide ? undefined : { display: 'none' }}
            >
              <span className="mc-welcome__step-num">{s.n}</span>
              <div>
                <strong>{s.title}</strong>
                <span>{s.text}</span>
              </div>
            </div>
          ))}
        </div>

        <footer className="mc-welcome__foot">
          <button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" style={{ flex: 1 }} onClick={() => finish(false)}>
            {lang === 'en' ? 'Skip' : 'Пропустить'}
          </button>
          {!isLast ? (
            <button
              type="button"
              className="ds-btn ds-btn--primary ds-btn--sm"
              style={{ flex: 1 }}
              onClick={() => setSlide((s) => Math.min(s + 1, copy.steps.length - 1))}
            >
              {lang === 'en' ? 'Next' : 'Далее'}
            </button>
          ) : (
            <button
              type="button"
              className="ds-btn ds-btn--primary ds-btn--sm"
              style={{ flex: 1 }}
              onClick={() => finish(true)}
            >
              {lang === 'en' ? 'Start tour' : 'Начать тур'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
