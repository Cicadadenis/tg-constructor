/**
 * Analytics UI copy — product terminology layer.
 */

export function getAnalyticsLabels(lang = 'ru') {
  if (lang === 'en') {
    return {
      title: 'Analytics',
      subtitle: 'Realtime automation metrics for this flow',
      popout: 'Floating panel',
      reset: 'Reset',
      kpi: {
        activeUsers: 'Active users',
        liveSessions: 'Live sessions',
        completion: 'Completion',
        conversions: 'Conversions',
      },
      tabs: {
        overview: 'Overview',
        performance: 'Performance',
        funnel: 'Funnel',
        flow: 'Flow',
        nodes: 'Nodes',
        observe: 'Logs & traces',
      },
      performance: {
        throughput: 'Events / min',
        throughputHint: 'Last 60 seconds',
        avgTime: 'Avg run time',
        failRate: 'Failure rate',
        suspended: 'Paused runs',
        activity: 'Event throughput',
        edgeFlow: 'Top transitions',
        edgeEmpty: 'Run the simulator or publish to collect path data',
      },
      dropOff: 'Drop-off by step (%)',
      userPaths: 'User paths',
      pathsEmpty: 'Paths appear after simulator or live sessions',
      failedNodes: 'Failed steps',
      runtimeLogs: 'Runtime logs',
      traceReplay: 'Execution trace replay',
      loadTrace: 'Load trace',
      noErrors: 'No step errors yet',
    };
  }
  if (lang === 'uk') {
    return {
      title: 'Аналітика',
      subtitle: 'Метрики автоматизації в реальному часі',
      popout: 'Плаваюча панель',
      reset: 'Скинути',
      kpi: {
        activeUsers: 'Активні',
        liveSessions: 'Сесії',
        completion: 'Завершення',
        conversions: 'Конверсії',
      },
      tabs: {
        overview: 'Огляд',
        performance: 'Швидкодія',
        funnel: 'Воронка',
        flow: 'Сценарій',
        nodes: 'Кроки',
        observe: 'Логи',
      },
      performance: {
        throughput: 'Події / хв',
        throughputHint: 'Останні 60 с',
        avgTime: 'Середній час',
        failRate: 'Помилки',
        suspended: 'На паузі',
        activity: 'Потік подій',
        edgeFlow: 'Переходи',
        edgeEmpty: 'Запустіть симулятор для збору даних',
      },
      dropOff: 'Відсів по кроках (%)',
      userPaths: 'Шляхи',
      pathsEmpty: 'Шляхи зʼявляться після сесій',
      failedNodes: 'Помилки кроків',
      runtimeLogs: 'Логи',
      traceReplay: 'Трасування',
      loadTrace: 'Завантажити',
      noErrors: 'Помилок поки немає',
    };
  }
  return {
    title: 'Аналитика',
    subtitle: 'Метрики автоматизации в реальном времени',
    popout: 'Плавающая панель',
    reset: 'Сброс',
    kpi: {
      activeUsers: 'Активные',
      liveSessions: 'Сессии',
      completion: 'Завершение',
      conversions: 'Конверсии',
    },
    tabs: {
      overview: 'Обзор',
      performance: 'Производительность',
      funnel: 'Воронка',
      flow: 'Сценарий',
      nodes: 'Шаги',
      observe: 'Логи',
    },
    performance: {
      throughput: 'События / мин',
      throughputHint: 'Последние 60 сек',
      avgTime: 'Среднее время',
      failRate: 'Ошибки',
      suspended: 'На паузе',
      activity: 'Поток событий',
      edgeFlow: 'Переходы',
      edgeEmpty: 'Запустите симулятор для сбора данных',
    },
    dropOff: 'Отсев по шагам (%)',
    userPaths: 'Пути пользователей',
    pathsEmpty: 'Пути появятся после сессий в симуляторе',
    failedNodes: 'Ошибки шагов',
    runtimeLogs: 'Логи выполнения',
    traceReplay: 'Трассировка',
    loadTrace: 'Загрузить',
    noErrors: 'Ошибок шагов пока нет',
  };
}
