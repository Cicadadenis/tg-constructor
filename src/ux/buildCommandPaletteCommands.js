/**
 * Command palette registry — Figma / Raycast style actions.
 * @param {object} ctx
 */
export function buildCommandPaletteCommands(ctx) {
  const {
    lang = 'ru',
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onSave,
    onToggleFocus,
    onFitCanvas,
    onOpenHelp,
    onToggleHistory,
    onAddMessage,
    onAddCondition,
    onTestFlow,
    onDuplicateSelection,
    onDeleteSelection,
    onGroupSelection,
    setAppSection,
  } = ctx;

  const t = lang === 'en'
    ? {
      undo: 'Undo', redo: 'Redo', save: 'Save project', focus: 'Focus mode',
      fit: 'Fit canvas', help: 'Keyboard shortcuts', history: 'History timeline',
      msg: 'Add message step', cond: 'Add condition', test: 'Test flow',
      dup: 'Duplicate step', del: 'Delete selection', group: 'Group selection',
      flows: 'Open flows', canvas: 'Go to canvas',
    }
    : {
      undo: 'Отменить', redo: 'Повторить', save: 'Сохранить', focus: 'Режим фокуса',
      fit: 'Вписать холст', help: 'Горячие клавиши', history: 'История изменений',
      msg: 'Добавить сообщение', cond: 'Добавить условие', test: 'Тест сценария',
      dup: 'Дублировать шаг', del: 'Удалить выделение', group: 'Сгруппировать',
      flows: 'Открыть сценарии', canvas: 'На холст',
    };

  const mod = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl';

  return [
    { id: 'undo', label: t.undo, shortcut: `${mod}+Z`, section: 'edit', disabled: !canUndo, run: onUndo },
    { id: 'redo', label: t.redo, shortcut: `${mod}+Shift+Z`, section: 'edit', disabled: !canRedo, run: onRedo },
    { id: 'save', label: t.save, shortcut: `${mod}+S`, section: 'edit', run: onSave },
    { id: 'fit', label: t.fit, shortcut: `${mod}+0`, section: 'view', run: onFitCanvas },
    { id: 'focus', label: t.focus, shortcut: 'F', section: 'view', run: onToggleFocus },
    { id: 'history', label: t.history, shortcut: `${mod}+H`, section: 'view', run: onToggleHistory },
    { id: 'help', label: t.help, shortcut: '?', section: 'view', run: onOpenHelp },
    { id: 'add-msg', label: t.msg, shortcut: 'M', section: 'build', run: onAddMessage },
    { id: 'add-cond', label: t.cond, shortcut: 'C', section: 'build', run: onAddCondition },
    { id: 'test', label: t.test, shortcut: `${mod}+Enter`, section: 'build', run: onTestFlow },
    { id: 'dup', label: t.dup, shortcut: `${mod}+D`, section: 'selection', run: onDuplicateSelection },
    { id: 'group', label: t.group, shortcut: `${mod}+G`, section: 'selection', run: onGroupSelection },
    { id: 'del', label: t.del, shortcut: 'Del', section: 'selection', run: onDeleteSelection },
    { id: 'flows', label: t.flows, section: 'nav', run: () => setAppSection?.('flows') },
    { id: 'canvas', label: t.canvas, section: 'nav', run: () => setAppSection?.('flows') },
  ].filter((c) => typeof c.run === 'function');
}

export function filterCommands(commands, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return commands;
  return commands.filter((c) => {
    const hay = `${c.label} ${c.id} ${c.section || ''}`.toLowerCase();
    return hay.includes(q);
  });
}
