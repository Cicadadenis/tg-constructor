import React from 'react';
import { motion } from 'framer-motion';

const TIPS = {
  ru: [
    'Выберите шаг на холсте',
    'Двойной клик — быстрое редактирование',
    'Перетащите шаг из шаблонов',
  ],
  en: [
    'Select a step on the canvas',
    'Double-click for quick edit',
    'Drag a block from templates',
  ],
  uk: [
    'Оберіть крок на полотні',
    'Подвійний клік — швидке редагування',
    'Перетягніть блок із шаблонів',
  ],
};

export default function FlowInspectorEmpty({ lang = 'ru', onFocusCanvas }) {
  const tips = TIPS[lang] || TIPS.ru;
  const title = lang === 'en'
    ? 'Select a block on the flow'
    : lang === 'uk'
      ? 'Оберіть блок у сценарії'
      : 'Выберите блок на сценарии';
  const subtitle = lang === 'en'
    ? 'Settings will appear here.'
    : lang === 'uk'
      ? 'Налаштування зʼявляться тут.'
      : 'Настройки появятся здесь';

  return (
    <motion.div
      className="fi-empty"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="fi-empty__visual" aria-hidden>
        <div className="fi-empty__bubble fi-empty__bubble--bot">👋</div>
        <div className="fi-empty__bubble fi-empty__bubble--user">…</div>
      </div>
      <h3 className="fi-empty__title">{title}</h3>
      <p className="fi-empty__subtitle">{subtitle}</p>
      <ul className="fi-empty__tips">
        {tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
      {onFocusCanvas && (
        <button type="button" className="fi-empty__cta" onClick={onFocusCanvas}>
          {lang === 'en' ? 'Go to canvas' : lang === 'uk' ? 'До полотна' : 'На холст'}
        </button>
      )}
    </motion.div>
  );
}
