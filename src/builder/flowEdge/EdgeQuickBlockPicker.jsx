import React from 'react';
import { createPortal } from 'react-dom';
import { getBlockDef } from '../../constructor/block_catalog.js';
import { EDGE_QUICK_PICKER_GROUPS, edgeQuickPickerGroupLabel } from './edgeQuickPickerCatalog.js';
import './flow-add-step.css';

/**
 * @param {object} props
 * @param {{ x: number, y: number }} props.anchor — screen coordinates
 * @param {string} [props.lang]
 * @param {object} [props.blockTypes]
 * @param {(type: string) => void} props.onPick
 * @param {() => void} props.onClose
 */
export function EdgeQuickBlockPicker({ anchor, lang = 'ru', blockTypes, onPick, onClose }) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    const onPointer = (e) => {
      if (ref.current?.contains(e.target)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, [onClose]);

  const style = {
    position: 'fixed',
    left: anchor.x,
    top: anchor.y,
    transform: 'translate(-50%, -50%)',
    zIndex: 1200,
  };

  return createPortal(
    <div
      ref={ref}
      className="edge-quick-picker"
      style={style}
      role="dialog"
      aria-label={lang === 'en' ? 'Add step' : 'Добавить шаг'}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="edge-quick-picker__title">
        {lang === 'en' ? 'Add step' : 'Добавить шаг'}
      </div>
      <div className="edge-quick-picker__groups">
        {EDGE_QUICK_PICKER_GROUPS.map((group) => (
          <section key={group.id} className="edge-quick-picker__group">
            <div className="edge-quick-picker__group-label">
              {edgeQuickPickerGroupLabel(group, lang)}
            </div>
            <div className="edge-quick-picker__items">
              {group.items.map((item) => {
                const def = getBlockDef(item.type, blockTypes);
                const label = def?.label || item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    className="edge-quick-picker__item"
                    onClick={() => onPick(item.type)}
                  >
                    <span className="edge-quick-picker__item-icon" aria-hidden>
                      {item.icon || def?.icon || '◆'}
                    </span>
                    <span className="edge-quick-picker__item-label">{label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>,
    document.body,
  );
}
