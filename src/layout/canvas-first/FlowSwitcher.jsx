import React, { useMemo, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { SidebarIcons } from '../sidebar/sidebarIcons.jsx';

/**
 * Compact flow picker — canvas-first sidebar header (not a full list panel).
 */
export default function FlowSwitcher({
  lang = 'ru',
  items = [],
  activeListId = null,
  activeFlowName = '',
  onSelectListItem,
  onCreateFlow,
  onOpenFlowsDrawer,
}) {
  const [open, setOpen] = useState(false);

  const activeItem = useMemo(
    () => items.find((i) => i.id === activeListId) || null,
    [items, activeListId],
  );

  const displayName = activeFlowName
    || activeItem?.name
    || (lang === 'en' ? 'Untitled flow' : lang === 'uk' ? 'Без назви' : 'Без названия');

  const label = lang === 'en' ? 'Flow' : lang === 'uk' ? 'Сценарій' : 'Сценарий';
  const allFlows = lang === 'en' ? 'All flows' : lang === 'uk' ? 'Усі сценарії' : 'Все сценарии';
  const newFlow = lang === 'en' ? 'New flow' : lang === 'uk' ? 'Новий' : 'Новый';

  const recent = useMemo(() => items.slice(0, 8), [items]);

  return (
    <div className="cf-flow-switcher">
      <span className="cf-flow-switcher__label">{label}</span>
      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <button type="button" className="cf-flow-switcher__trigger" aria-haspopup="listbox">
            <span className="cf-flow-switcher__name">{displayName}</span>
            <span className="cf-flow-switcher__chev" aria-hidden>▾</span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="cf-flow-switcher__menu" sideOffset={6} align="start">
            {recent.map((item) => (
              <DropdownMenu.Item
                key={item.id}
                className={`cf-flow-switcher__item${item.id === activeListId ? ' cf-flow-switcher__item--active' : ''}`}
                onSelect={() => {
                  setOpen(false);
                  onSelectListItem?.(item.id);
                }}
              >
                <span className="cf-flow-switcher__item-name">{item.name}</span>
                {item.id === activeListId && <span className="cf-flow-switcher__check">✓</span>}
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator className="cf-flow-switcher__sep" />
            <DropdownMenu.Item
              className="cf-flow-switcher__item cf-flow-switcher__item--action"
              onSelect={() => {
                setOpen(false);
                onCreateFlow?.();
              }}
            >
              {SidebarIcons.plus}
              {newFlow}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="cf-flow-switcher__item cf-flow-switcher__item--action"
              onSelect={() => {
                setOpen(false);
                onOpenFlowsDrawer?.();
              }}
            >
              {allFlows}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
