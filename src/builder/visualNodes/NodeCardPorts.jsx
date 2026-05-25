import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { portKindTheme } from './visualPortTheme.js';

/**
 * Smart handles + bottom insertion affordance (ManyChat-style).
 */
export default function NodeCardPorts({
  layout,
  visual,
  showInsert = false,
  onInsert,
  lang = 'ru',
  hovered = false,
  selected = false,
}) {
  const { contentOffsetX, contentOffsetY, hasTopSocket } = layout;
  const outputs = visual.outputPorts || [];
  const showHandles = hovered || selected;

  const insertLabel = lang === 'en' ? 'Add step' : lang === 'uk' ? 'Додати крок' : 'Добавить шаг';

  return (
    <>
      {hasTopSocket && visual.inputPort && (
        <div
          className={`vn-port vn-port--target${showHandles ? ' vn-port--visible' : ''}`}
          style={{
            top: contentOffsetY - 6,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <span className="vn-port__ring" aria-hidden />
          <Handle
            type="target"
            position={Position.Top}
            id={visual.inputPort.id}
            className="vn-port__handle"
            style={{ background: visual.spec.accent }}
          />
        </div>
      )}

      {outputs.length === 1 && (() => {
        const port = outputs[0];
        const theme = portKindTheme(port.kind);
        return (
          <div
            className={`vn-port vn-port--source${showHandles ? ' vn-port--visible' : ''}`}
            style={{
              bottom: contentOffsetY - 6,
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            <span className="vn-port__ring vn-port__ring--out" style={{ borderColor: theme.color }} aria-hidden />
            <Handle
              type="source"
              position={Position.Bottom}
              id={port.id}
              className={`vn-port__handle ${theme.className}`}
              style={{ background: theme.color }}
            />
          </div>
        );
      })()}

      {outputs.length > 1 && outputs.map((port, index) => {
        const pct = ((index + 1) / (outputs.length + 1)) * 100;
        const theme = portKindTheme(port.kind);
        return (
          <React.Fragment key={port.id}>
            <div
              className={`vn-port vn-port--source vn-port--branch${showHandles ? ' vn-port--visible' : ''}`}
              style={{
                bottom: contentOffsetY - 6,
                left: `${pct}%`,
                transform: 'translateX(-50%)',
              }}
            >
              <span
                className="vn-port__ring vn-port__ring--out"
                style={{ borderColor: theme.color }}
                aria-hidden
              />
              <Handle
                type="source"
                position={Position.Bottom}
                id={port.id}
                className={`vn-port__handle ${theme.className}`}
                style={{ background: theme.color }}
              />
            </div>
            {port.label && (
              <span
                className="vn-port__label"
                style={{
                  bottom: contentOffsetY - 22,
                  left: `${pct}%`,
                  color: theme.labelColor,
                }}
              >
                {port.label}
              </span>
            )}
          </React.Fragment>
        );
      })}

      {showInsert && onInsert && (
        <button
          type="button"
          className={`vn-insert${showHandles ? ' vn-insert--visible' : ''}`}
          style={{
            bottom: contentOffsetY - 18,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
          title={insertLabel}
          aria-label={insertLabel}
          onClick={(e) => {
            e.stopPropagation();
            onInsert();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="vn-insert__icon">+</span>
        </button>
      )}
    </>
  );
}
