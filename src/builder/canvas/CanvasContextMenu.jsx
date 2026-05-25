import React, { useEffect, useRef } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

/**
 * @param {object} props
 * @param {{ type: 'node' | 'pane' | 'edge', nodeId?: string, edgeId?: string, x: number, y: number } | null} props.menu
 * @param {() => void} props.onClose
 * @param {string} [props.lang]
 * @param {object} [props.actions]
 * @param {() => void} [props.onFitFlow]
 * @param {() => void} [props.onGroupSelection]
 * @param {(edgeId: string) => void} [props.onRemoveEdge]
 */
export default function CanvasContextMenu({
  menu,
  onClose,
  lang = 'ru',
  actions,
  onFitFlow,
  onGroupSelection,
  onRemoveEdge,
  onOpenCommandPalette,
  onAddMessageAtPane,
}) {
  const open = Boolean(menu);
  const anchorRef = useRef(null);

  useEffect(() => {
    if (!menu || !anchorRef.current) return;
    anchorRef.current.style.left = `${menu.x}px`;
    anchorRef.current.style.top = `${menu.y}px`;
  }, [menu]);

  const t = lang === 'en'
    ? {
        inspect: 'Properties',
        duplicate: 'Duplicate',
        delete: 'Delete',
        addAfter: 'Add next step',
        fit: 'Fit to flow',
        group: 'Group selection',
        removeEdge: 'Remove connection',
        palette: 'Command palette',
        addMessage: 'Add message',
        selectAll: 'Select all',
      }
    : {
        inspect: 'Свойства',
        duplicate: 'Дублировать',
        delete: 'Удалить',
        addAfter: 'Добавить шаг',
        fit: 'Вместить сценарий',
        group: 'Сгруппировать',
        removeEdge: 'Удалить связь',
        palette: 'Палитра команд',
        addMessage: 'Сообщение',
        selectAll: 'Выделить всё',
      };

  return (
    <>
      <div
        ref={anchorRef}
        className="canvas-context-menu-anchor"
        style={{ position: 'fixed', width: 1, height: 1, pointerEvents: 'none', zIndex: 9998 }}
        aria-hidden
      />
      <DropdownMenu.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            style={{
              position: 'fixed',
              left: menu?.x ?? -9999,
              top: menu?.y ?? -9999,
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: open ? 'auto' : 'none',
            }}
          />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="mc-floating-menu canvas-context-menu"
            sideOffset={4}
            align="start"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {menu?.type === 'node' && (
              <>
                <DropdownMenu.Item
                  className="mc-floating-menu__item"
                  onSelect={() => {
                    const nodeId = menu.nodeId;
                    if (nodeId) actions?.onInspect?.(nodeId);
                    onClose();
                  }}
                >
                  {t.inspect}
                </DropdownMenu.Item>
                {actions?.onAddAfterNode && (
                  <DropdownMenu.Item
                    className="mc-floating-menu__item"
                    onSelect={() => {
                      actions.onAddAfterNode(menu.nodeId);
                      onClose();
                    }}
                  >
                    {t.addAfter}
                  </DropdownMenu.Item>
                )}
                {actions?.onDuplicateNode && (
                  <DropdownMenu.Item
                    className="mc-floating-menu__item"
                    onSelect={() => {
                      actions.onDuplicateNode(menu.nodeId);
                      onClose();
                    }}
                  >
                    {t.duplicate}
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Separator className="mc-floating-menu__separator" />
                {actions?.onDeleteNode && (
                  <DropdownMenu.Item
                    className="mc-floating-menu__item canvas-context-menu__danger"
                    onSelect={() => {
                      actions.onDeleteNode(menu.nodeId);
                      onClose();
                    }}
                  >
                    {t.delete}
                  </DropdownMenu.Item>
                )}
              </>
            )}
            {menu?.type === 'edge' && onRemoveEdge && (
              <DropdownMenu.Item
                className="mc-floating-menu__item canvas-context-menu__danger"
                onSelect={() => {
                  onRemoveEdge(menu.edgeId);
                  onClose();
                }}
              >
                {t.removeEdge}
              </DropdownMenu.Item>
            )}
            {menu?.type === 'pane' && (
              <>
                {onOpenCommandPalette && (
                  <DropdownMenu.Item
                    className="mc-floating-menu__item"
                    onSelect={() => {
                      onOpenCommandPalette();
                      onClose();
                    }}
                  >
                    ⌘ {t.palette}
                  </DropdownMenu.Item>
                )}
                {onAddMessageAtPane && (
                  <DropdownMenu.Item
                    className="mc-floating-menu__item"
                    onSelect={() => {
                      onAddMessageAtPane();
                      onClose();
                    }}
                  >
                    + {t.addMessage}
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Separator className="mc-floating-menu__separator" />
                {onFitFlow && (
                  <DropdownMenu.Item
                    className="mc-floating-menu__item"
                    onSelect={() => {
                      onFitFlow();
                      onClose();
                    }}
                  >
                    {t.fit}
                  </DropdownMenu.Item>
                )}
                {onGroupSelection && (
                  <DropdownMenu.Item
                    className="mc-floating-menu__item"
                    onSelect={() => {
                      onGroupSelection();
                      onClose();
                    }}
                  >
                    {t.group}
                  </DropdownMenu.Item>
                )}
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </>
  );
}
