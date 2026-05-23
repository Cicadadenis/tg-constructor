/**
 * Aiogram 3 example graph library — AST-first (Graph → Rules → Bind → Codegen).
 */

import { echo } from './echo.js';
import { weather } from './weather.js';
import { shop } from './shop.js';
import { keyboards } from './keyboards.js';
import { fsm } from './fsm.js';
import { callbacks } from './callbacks.js';
import { media } from './media.js';
import { full } from './full.js';
import { fullTest } from './fullTest.js';

/** @type {Readonly<Record<string, { nodes: object[], edges: object[] }>>} */
export const EXAMPLE_GRAPH_FLOWS = Object.freeze({
  echo,
  weather,
  shop,
  keyboards,
  fsm,
  callbacks,
  media,
  full,
  fullTest,
});

/** @type {Readonly<Record<string, string>>} */
export const EXAMPLE_CATEGORIES = Object.freeze({
  echo: 'basic_handlers',
  weather: 'keyboards',
  shop: 'basic_handlers',
  keyboards: 'keyboards',
  fsm: 'fsm',
  callbacks: 'callbacks',
  media: 'media',
  full: 'advanced_routing',
  fullTest: 'advanced_routing',
});

/** @type {Readonly<Record<string, { ru: string, en: string }>>} */
export const EXAMPLE_LABELS = Object.freeze({
  echo: { ru: '🔄 Эхо Бот', en: '🔄 Echo bot' },
  weather: { ru: '☀️ Бот погода', en: '☀️ Weather bot' },
  shop: { ru: '🛍️ Магазин', en: '🛍️ Shop bot' },
  keyboards: { ru: '⌨️ Клавиатуры (AST)', en: '⌨️ Keyboards (AST)' },
  fsm: { ru: '📋 FSM профиль', en: '📋 FSM profile' },
  callbacks: { ru: '🔗 Callbacks', en: '🔗 Callbacks' },
  media: { ru: '🖼 Медиа', en: '🖼 Media' },
  full: { ru: '⚡ Маршрутизация', en: '⚡ Routing demo' },
  fullTest: { ru: '🧪 Full Test', en: '🧪 Full Test' },
});

export const EXAMPLE_KEYS = Object.freeze(Object.keys(EXAMPLE_GRAPH_FLOWS));
