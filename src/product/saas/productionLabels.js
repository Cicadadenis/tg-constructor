/**
 * Production SaaS hub copy.
 */

export function getProductionLabels(lang = 'ru') {
  if (lang === 'en') {
    return {
      hubTitle: 'Flow workspace',
      tabs: {
        overview: 'Overview',
        versions: 'Versions',
        templates: 'Templates',
        modules: 'Modules',
        components: 'Components',
        io: 'Import / Export',
        collab: 'Collaboration',
      },
      overview: {
        autosave: 'Autosave',
        autosaveHint: 'Changes save locally as you edit',
        undo: 'Undo / redo',
        undoHint: 'Ctrl+Z · timeline on canvas',
        draft: 'Draft',
        published: 'Published',
        draftHint: 'Publish to push live',
      },
      versions: { empty: 'No versions yet', restore: 'Restore', snapshot: 'Save snapshot' },
      templates: { use: 'Use template' },
      modules: { open: 'Open module library' },
      components: { insert: 'Insert on canvas' },
      io: { export: 'Export JSON', import: 'Import JSON', exportHint: 'Portable flow file' },
      collab: {
        coming: 'Realtime collaboration is coming soon',
        room: 'Room ID',
        copyLink: 'Copy invite link',
        copied: 'Link copied',
      },
      openHub: 'Workspace',
    };
  }
  if (lang === 'uk') {
    return {
      hubTitle: 'Робочий простір',
      tabs: {
        overview: 'Огляд',
        versions: 'Версії',
        templates: 'Шаблони',
        modules: 'Модулі',
        components: 'Компоненти',
        io: 'Імпорт / Експорт',
        collab: 'Співпраця',
      },
      overview: {
        autosave: 'Автозбереження',
        autosaveHint: 'Зміни зберігаються локально',
        undo: 'Скасувати / повторити',
        undoHint: 'Ctrl+Z · таймлайн на полотні',
        draft: 'Чернетка',
        published: 'Опубліковано',
        draftHint: 'Опублікуйте для запуску',
      },
      versions: { empty: 'Версій ще немає', restore: 'Відновити', snapshot: 'Зберегти знімок' },
      templates: { use: 'Використати' },
      modules: { open: 'Бібліотека модулів' },
      components: { insert: 'Додати на полотно' },
      io: { export: 'Експорт JSON', import: 'Імпорт JSON', exportHint: 'Портативний файл' },
      collab: {
        coming: 'Спільна робота незабаром',
        room: 'ID кімнати',
        copyLink: 'Копіювати запрошення',
        copied: 'Посилання скопійовано',
      },
      openHub: 'Простір',
    };
  }
  return {
    hubTitle: 'Рабочее пространство',
    tabs: {
      overview: 'Обзор',
      versions: 'Версии',
      templates: 'Шаблоны',
      modules: 'Модули',
      components: 'Компоненты',
      io: 'Импорт / Экспорт',
      collab: 'Совместная работа',
    },
    overview: {
      autosave: 'Автосохранение',
      autosaveHint: 'Изменения сохраняются локально при редактировании',
      undo: 'Отмена / повтор',
      undoHint: 'Ctrl+Z · таймлайн на холсте',
      draft: 'Черновик',
      published: 'Опубликовано',
      draftHint: 'Опубликуйте, чтобы запустить сценарий',
    },
    versions: { empty: 'Версий пока нет', restore: 'Восстановить', snapshot: 'Сохранить снимок' },
    templates: { use: 'Использовать' },
    modules: { open: 'Библиотека модулей' },
    components: { insert: 'Добавить на холст' },
    io: { export: 'Экспорт JSON', import: 'Импорт JSON', exportHint: 'Портативный файл сценария' },
    collab: {
      coming: 'Совместное редактирование скоро',
      room: 'ID комнаты',
      copyLink: 'Копировать ссылку',
      copied: 'Ссылка скопирована',
    },
    openHub: 'Пространство',
  };
}
