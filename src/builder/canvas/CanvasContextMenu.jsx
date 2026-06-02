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
  isMobile = false,
  actions,
  onFitFlow,
  onGroupSelection,
  onRemoveEdge,
  onOpenCommandPalette,
  onAddMessageAtPane,
}) {
  const open = Boolean(menu);
  const anchorRef = useRef(null);
  const mobileNodeMenu = isMobile && menu?.type === 'node';
  const mobilePaneMenu = isMobile && menu?.type === 'pane';
  const menuContentStyle = {
    minWidth: isMobile ? 220 : 180,
    padding: isMobile ? 6 : 4,
    borderRadius: isMobile ? 12 : 10,
    border: '1px solid rgba(15, 23, 42, 0.12)',
    background: '#ffffff',
    color: '#0f172a',
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.16)',
  };
  const menuItemStyle = {
    display: 'flex',
    alignItems: 'center',
    minHeight: isMobile ? 44 : 36,
    padding: isMobile ? '10px 12px' : '8px 10px',
    borderRadius: isMobile ? 10 : 8,
    background: 'transparent',
    color: '#0f172a',
    fontSize: isMobile ? 14 : 13,
    lineHeight: 1.35,
  };
  const dangerItemStyle = {
    ...menuItemStyle,
    color: '#dc2626',
  };
  const separatorStyle = {
    height: 1,
    margin: '4px 6px',
    background: 'rgba(15, 23, 42, 0.08)',
  };

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
        inspect: isMobile ? 'Открыть свойства' : 'Свойства',
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
            style={menuContentStyle}
            sideOffset={4}
            align="start"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {menu?.type === 'node' && (
              <>
                <DropdownMenu.Item
                  className="mc-floating-menu__item"
                  style={menuItemStyle}
                  onSelect={() => {
                    const nodeId = menu.nodeId;
                    if (nodeId) actions?.onInspect?.(nodeId);
                    onClose();
                  }}
                >
                  {t.inspect}
                </DropdownMenu.Item>
                {!mobileNodeMenu && actions?.onAddAfterNode && (
                  <DropdownMenu.Item
                    className="mc-floating-menu__item"
                    style={menuItemStyle}
                    onSelect={() => {
                      actions.onAddAfterNode(menu.nodeId);
                      onClose();
                    }}
                  >
                    {t.addAfter}
                  </DropdownMenu.Item>
                )}
                {!mobileNodeMenu && actions?.onDuplicateNode && (
                  <DropdownMenu.Item
                    className="mc-floating-menu__item"
                    style={menuItemStyle}
                    onSelect={() => {
                      actions.onDuplicateNode(menu.nodeId);
                      onClose();
                    }}
                  >
                    {t.duplicate}
                  </DropdownMenu.Item>
                )}
                {(!mobileNodeMenu && (actions?.onAddAfterNode || actions?.onDuplicateNode || actions?.onDeleteNode))
                  ? <DropdownMenu.Separator className="mc-floating-menu__separator" style={separatorStyle} />
                  : null}
                {actions?.onDeleteNode && (
                  <DropdownMenu.Item
                    className="mc-floating-menu__item canvas-context-menu__danger"
                    style={dangerItemStyle}
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
                style={dangerItemStyle}
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
                {!mobilePaneMenu && onOpenCommandPalette && (
                  <DropdownMenu.Item
                    className="mc-floating-menu__item"
                    style={menuItemStyle}
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
                    style={menuItemStyle}
                    onSelect={() => {
                      onAddMessageAtPane();
                      onClose();
                    }}
                  >
                    + {t.addMessage}
                  </DropdownMenu.Item>
                )}
                {((!mobilePaneMenu && onOpenCommandPalette) || onFitFlow || (!mobilePaneMenu && onGroupSelection))
                  ? <DropdownMenu.Separator className="mc-floating-menu__separator" style={separatorStyle} />
                  : null}
                {onFitFlow && (
                  <DropdownMenu.Item
                    className="mc-floating-menu__item"
                    style={menuItemStyle}
                    onSelect={() => {
                      onFitFlow();
                      onClose();
                    }}
                  >
                    {t.fit}
                  </DropdownMenu.Item>
                )}
                {!mobilePaneMenu && onGroupSelection && (
                  <DropdownMenu.Item
                    className="mc-floating-menu__item"
                    style={menuItemStyle}
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
