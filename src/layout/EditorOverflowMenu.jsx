import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '../../design-system/react/utils/cn.js';

/**
 * Secondary editor actions (ManyChat-style ··· menu).
 * @param {object} props
 * @param {string} [props.lang]
 * @param {React.ReactNode} props.children — DropdownMenu.Item nodes
 * @param {string} [props.label]
 */
export default function EditorOverflowMenu({ lang = 'ru', children, label }) {
  const menuLabel = label || (lang === 'en' ? 'More actions' : lang === 'uk' ? 'Більше дій' : 'Ещё');

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn('mc-btn', 'mc-btn--secondary', 'mc-btn--sm', 'mc-focus-ring')}
          aria-label={menuLabel}
        >
          ···
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="mc-floating-menu mc-editor-overflow"
          sideOffset={8}
          align="end"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/**
 * @param {object} props
 * @param {() => void} props.onSelect
 * @param {React.ReactNode} props.children
 * @param {boolean} [props.disabled]
 */
export function EditorOverflowItem({ onSelect, children, disabled }) {
  return (
    <DropdownMenu.Item
      className="mc-floating-menu__item mc-editor-overflow__item"
      onSelect={onSelect}
      disabled={disabled}
    >
      {children}
    </DropdownMenu.Item>
  );
}

export function EditorOverflowSeparator() {
  return <DropdownMenu.Separator className="mc-floating-menu__separator" />;
}
