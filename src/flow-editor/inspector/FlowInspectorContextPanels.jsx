import React from 'react';
import FlowInspectorSection from './FlowInspectorSection.jsx';

export function FlowInspectorAudiencePanel({ lang = 'ru', blockType }) {
  const title = lang === 'en' ? 'Who sees this step' : lang === 'uk' ? 'Хто бачить цей крок' : 'Кто видит этот шаг';
  const hint = lang === 'en'
    ? 'Audience filters apply at flow level. This step runs for everyone unless a condition limits it.'
    : 'Фильтры аудитории задаются на уровне сценария. Шаг выполняется для всех, пока условие не ограничит ветку.';

  return (
    <div className="fi-context">
      <FlowInspectorSection title={title} defaultOpen>
        <p className="fi-context__lead">{hint}</p>
        <div className="fi-context__cards">
          <div className="fi-context__card fi-context__card--active">
            <span className="fi-context__card-icon">🌐</span>
            <div>
              <strong>{lang === 'en' ? 'Everyone' : 'Все подписчики'}</strong>
              <span>{lang === 'en' ? 'Default audience' : 'По умолчанию'}</span>
            </div>
          </div>
          <button type="button" className="fi-context__card fi-context__card--ghost" disabled>
            <span className="fi-context__card-icon">🏷</span>
            <div>
              <strong>{lang === 'en' ? 'Tags & segments' : 'Теги и сегменты'}</strong>
              <span>{lang === 'en' ? 'Coming soon' : 'Скоро'}</span>
            </div>
          </button>
        </div>
        {blockType === 'condition' && (
          <p className="fi-context__note">
            {lang === 'en'
              ? 'Tip: use Logic tab to edit branching rules.'
              : 'Подсказка: ветвление настраивается во вкладке «Логика».'}
          </p>
        )}
      </FlowInspectorSection>
    </div>
  );
}

export function FlowInspectorAnalyticsPanel({
  lang = 'ru',
  blockType,
  flowName,
  nodeCount = 0,
}) {
  const isAnalyticsNode = blockType === 'analytics';

  return (
    <div className="fi-context">
      <FlowInspectorSection
        title={lang === 'en' ? 'Performance' : 'Показатели'}
        defaultOpen
      >
        <div className="fi-stats">
          <div className="fi-stats__item">
            <span className="fi-stats__value">{nodeCount}</span>
            <span className="fi-stats__label">{lang === 'en' ? 'Steps in flow' : 'Шагов в сценарии'}</span>
          </div>
          <div className="fi-stats__item fi-stats__item--muted">
            <span className="fi-stats__value">—</span>
            <span className="fi-stats__label">{lang === 'en' ? 'Reached' : 'Дошли до шага'}</span>
          </div>
          <div className="fi-stats__item fi-stats__item--muted">
            <span className="fi-stats__value">—</span>
            <span className="fi-stats__label">{lang === 'en' ? 'Conversion' : 'Конверсия'}</span>
          </div>
        </div>
        {flowName && (
          <p className="fi-context__lead">
            {lang === 'en' ? 'Flow: ' : 'Сценарий: '}
            <strong>{flowName}</strong>
          </p>
        )}
      </FlowInspectorSection>

      {isAnalyticsNode ? (
        <FlowInspectorSection
          title={lang === 'en' ? 'Event' : 'Событие'}
          defaultOpen
        >
          <p className="fi-context__lead">
            {lang === 'en'
              ? 'Configure the event name and payload in Content and Logic tabs.'
              : 'Имя события и параметры — во вкладках «Контент» и «Логика».'}
          </p>
        </FlowInspectorSection>
      ) : (
        <FlowInspectorSection
          title={lang === 'en' ? 'Tracking' : 'Отслеживание'}
          defaultOpen={false}
        >
          <p className="fi-context__lead">
            {lang === 'en'
              ? 'Add an Analytics block after this step to measure drop-off.'
              : 'Добавьте шаг «Аналитика» после этого, чтобы измерить отвал.'}
          </p>
          <button type="button" className="fi-context__cta" disabled>
            {lang === 'en' ? 'Add analytics step' : '+ Блок аналитики'}
          </button>
        </FlowInspectorSection>
      )}
    </div>
  );
}
