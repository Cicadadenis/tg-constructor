import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

const CONVERT_TYPES = [
  { type: 'message', icon: '💬', label: { ru: 'Сообщение', en: 'Message', uk: 'Повідомлення' } },
  { type: 'ask', icon: '❓', label: { ru: 'Вопрос', en: 'Question', uk: 'Питання' } },
  { type: 'condition', icon: '⑂', label: { ru: 'Условие', en: 'Condition', uk: 'Умова' } },
  { type: 'delay', icon: '⏱', label: { ru: 'Пауза', en: 'Delay', uk: 'Пауза' } },
  { type: 'inline_keyboard', icon: '⌨', label: { ru: 'Клавиатура', en: 'Keyboard', uk: 'Клавіатура' } },
];

export default function FlowInspectorQuickActions({
  lang = 'ru',
  canDuplicate = true,
  canDelete = true,
  onDuplicate,
  onDelete,
  onAiImprove,
  onConvert,
  aiLoading = false,
}) {
  const t = lang === 'en'
    ? { duplicate: 'Duplicate', ai: 'AI improve', convert: 'Convert', delete: 'Delete' }
    : lang === 'uk'
      ? { duplicate: 'Дублювати', ai: 'AI покращити', convert: 'Конвертувати', delete: 'Видалити' }
      : { duplicate: 'Дублировать', ai: 'AI улучшить', convert: 'Конвертировать', delete: 'Удалить' };

  const labelFor = (item) => item.label[lang] || item.label.ru;

  return (
    <div className="fi-quick-actions">
      {onAiImprove && (
        <button
          type="button"
          className="fi-quick-actions__btn fi-quick-actions__btn--ai"
          onClick={onAiImprove}
          disabled={aiLoading}
          title={t.ai}
        >
          ✨ {aiLoading ? '…' : t.ai}
        </button>
      )}
      {canDuplicate && onDuplicate && (
        <button
          type="button"
          className="fi-quick-actions__btn"
          onClick={onDuplicate}
          title={t.duplicate}
        >
          ⧉
        </button>
      )}
      {onConvert && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className="fi-quick-actions__btn" title={t.convert}>
              ⇄
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="fi-dropdown" sideOffset={6} align="end">
              {CONVERT_TYPES.map((item) => (
                <DropdownMenu.Item
                  key={item.type}
                  className="fi-dropdown__item"
                  onSelect={() => onConvert(item.type)}
                >
                  <span className="fi-dropdown__icon">{item.icon}</span>
                  {labelFor(item)}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
      {canDelete && onDelete && (
        <button
          type="button"
          className="fi-quick-actions__btn fi-quick-actions__btn--danger"
          onClick={onDelete}
          title={t.delete}
        >
          🗑
        </button>
      )}
    </div>
  );
}
