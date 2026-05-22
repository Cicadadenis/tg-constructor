import React, { useCallback, useMemo } from 'react';
import {
  normalizeInlineKeyboardData,
  serializeInlineKeyboardData,
  BUTTON_TYPES,
  countButtons,
} from '../inline_keyboard/inline_keyboard_model.js';
import {
  addRow,
  addButton,
  removeButton,
  duplicateButton,
  updateButton,
  moveButton,
  moveRow,
  setOptions,
  bindButtonHandler,
} from '../inline_keyboard/inline_keyboard_editor.js';
import SmartGraphRefPicker from '../SmartGraphRefPicker.jsx';
import { listInlineKeyboardActionRefs } from '../../constructor/graph_document/graph_reference_registry.js';
import { generateCallbackId } from '../../constructor/graph_document/graph_keyboard_nodes.js';
import { collectKeyboardButtonDiagnostics } from '../../constructor/graph_document/graph_keyboard_nodes.js';

const BTN_STYLE = {
  padding: '4px 8px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.85)',
  fontSize: 10,
  cursor: 'pointer',
};

const INPUT_STYLE = {
  width: '100%',
  padding: '6px 8px',
  fontSize: 11,
  borderRadius: 6,
  border: '1px solid rgba(99,102,241,0.35)',
  background: 'var(--bg)',
  color: 'var(--text)',
};

/**
 * Full inspector for inline_keyboard / reply_keyboard graph nodes.
 */
export default function InlineKeyboardInspector({
  block,
  nodeType = 'inline_keyboard',
  onDataChange,
  graphRefIndex,
  graphDocument,
  onJumpToNode,
  onCreateCallbackHandler,
  lang = 'ru',
}) {
  const model = useMemo(
    () => normalizeInlineKeyboardData(block?.props || block?.data || {}, nodeType),
    [block?.props, block?.data, nodeType],
  );

  const handlerRefs = useMemo(
    () => listInlineKeyboardActionRefs(graphRefIndex),
    [graphRefIndex],
  );

  const warnings = useMemo(() => {
    if (!graphDocument || !block?.id) return [];
    const node = graphDocument.nodes?.[block.id];
    if (!node) return [];
    return collectKeyboardButtonDiagnostics(
      { nodes: { [block.id]: { ...node, data: serializeInlineKeyboardData(model) } } },
      { allowMissingHandlers: true },
    );
  }, [graphDocument, block?.id, model]);

  const commit = useCallback((nextModel) => {
    onDataChange?.(serializeInlineKeyboardData(nextModel));
  }, [onDataChange]);

  const isInline = nodeType === 'inline_keyboard' || model.layout === 'inline';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.5 }}>
        {lang === 'en'
          ? 'Buttons are graph nodes. Callback data is generated at compile from linked handlers.'
          : 'Кнопки — узлы графа. callback_data генерируется при компиляции из привязанного обработчика.'}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={model.resize}
            onChange={(e) => commit(setOptions(model, { resize: e.target.checked }))}
          />
          {lang === 'en' ? 'Resize' : 'Подгонять размер'}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={model.oneTime}
            onChange={(e) => commit(setOptions(model, { oneTime: e.target.checked }))}
          />
          {lang === 'en' ? 'One-time' : 'Скрыть после нажатия'}
        </label>
        {isInline && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={model.persistent}
              onChange={(e) => commit(setOptions(model, { persistent: e.target.checked }))}
            />
            persistent
          </label>
        )}
      </div>

      {warnings.map((w, i) => (
        <div
          key={i}
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            fontSize: 11,
            color: '#fbbf24',
            background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.25)',
          }}
        >
          {w.message}
        </div>
      ))}

      {model.rows.map((row, ri) => (
        <div
          key={`row-${ri}`}
          style={{
            padding: 10,
            borderRadius: 10,
            border: '1px solid rgba(124,58,237,0.25)',
            background: 'rgba(124,58,237,0.06)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 9, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              {lang === 'en' ? `Row ${ri + 1}` : `Ряд ${ri + 1}`}
            </span>
            <span style={{ display: 'flex', gap: 4 }}>
              <button type="button" style={BTN_STYLE} onClick={() => commit(moveRow(model, ri, -1))}>↑</button>
              <button type="button" style={BTN_STYLE} onClick={() => commit(moveRow(model, ri, 1))}>↓</button>
              <button type="button" style={BTN_STYLE} onClick={() => commit(addButton(model, ri, nodeType))}>+ кн.</button>
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {row.map((btn, bi) => (
              <div
                key={btn.id}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.25)',
                  border: `1px solid ${btn.handlerNodeId ? 'rgba(62,207,142,0.35)' : 'rgba(248,113,113,0.35)'}`,
                }}
              >
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input
                    style={{ ...INPUT_STYLE, flex: 1 }}
                    value={btn.text}
                    onChange={(e) => commit(updateButton(model, ri, btn.id, { text: e.target.value }))}
                    placeholder={lang === 'en' ? 'Label' : 'Текст кнопки'}
                  />
                  <button type="button" style={BTN_STYLE} title="Влево" onClick={() => commit(moveButton(model, ri, btn.id, -1))}>←</button>
                  <button type="button" style={BTN_STYLE} title="Вправо" onClick={() => commit(moveButton(model, ri, btn.id, 1))}>→</button>
                  <button type="button" style={BTN_STYLE} onClick={() => commit(duplicateButton(model, ri, btn.id))}>⧉</button>
                  <button type="button" style={BTN_STYLE} onClick={() => commit(removeButton(model, ri, btn.id))}>✕</button>
                </div>

                <select
                  style={INPUT_STYLE}
                  value={btn.type === BUTTON_TYPES.URL ? BUTTON_TYPES.URL : BUTTON_TYPES.CALLBACK}
                  onChange={(e) => {
                    const type = e.target.value;
                    commit(updateButton(model, ri, btn.id, {
                      type,
                      url: type === BUTTON_TYPES.URL ? (btn.url || 'https://') : '',
                    }));
                  }}
                >
                  <option value={BUTTON_TYPES.CALLBACK}>{lang === 'en' ? 'Callback' : 'Действие'}</option>
                  <option value={BUTTON_TYPES.URL}>URL</option>
                </select>

                {btn.type === BUTTON_TYPES.URL ? (
                  <input
                    style={{ ...INPUT_STYLE, marginTop: 6 }}
                    value={btn.url || ''}
                    onChange={(e) => commit(updateButton(model, ri, btn.id, { url: e.target.value }))}
                    placeholder="https://"
                  />
                ) : (
                  <div style={{ marginTop: 8 }}>
                    <SmartGraphRefPicker
                      title={lang === 'en' ? 'On press?' : 'Что делать при нажатии?'}
                      refs={handlerRefs}
                      selectedRefId={btn.graphRefId || ''}
                      selectedCompileValue={btn.callbackId || ''}
                      onSelect={(ref) => commit(bindButtonHandler(model, ri, btn.id, ref))}
                      onJumpToNode={onJumpToNode}
                      onCreateNew={() => {
                        if (onCreateCallbackHandler) {
                          onCreateCallbackHandler({
                            displayLabel: btn.text,
                            ownerNodeId: block.id,
                            ownerType: nodeType,
                            attachmentId: btn.id,
                            compileValue: btn.callbackId || generateCallbackId(btn.text),
                          });
                        }
                      }}
                      createLabel={lang === 'en' ? 'Create handler' : 'Создать обработчик'}
                      emptyHint={
                        lang === 'en'
                          ? 'No handlers in graph — create one for this button.'
                          : 'Нет обработчиков в графе — создайте «При нажатии» для этой кнопки.'
                      }
                    />
                    {btn.handlerNodeId && (
                      <div style={{ marginTop: 6, fontSize: 10, color: '#3ecf8e' }}>
                        → handler: {btn.handlerNodeId.slice(0, 12)}…
                        {onJumpToNode && (
                          <button
                            type="button"
                            style={{ ...BTN_STYLE, marginLeft: 8 }}
                            onClick={() => onJumpToNode(btn.handlerNodeId)}
                          >
                            {lang === 'en' ? 'Jump' : 'Перейти'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          style={{
            ...BTN_STYLE,
            padding: '8px 14px',
            background: 'rgba(124,58,237,0.2)',
            borderColor: 'rgba(124,58,237,0.45)',
            color: '#c4b5fd',
            fontWeight: 700,
          }}
          onClick={() => commit(addRow(model, nodeType))}
        >
          + {lang === 'en' ? 'Add row' : 'Добавить ряд'}
        </button>
        <button
          type="button"
          style={BTN_STYLE}
          onClick={() => {
            let next = addRow(model, nodeType);
            const ri = next.rows.length - 1;
            next = addButton(next, ri, nodeType, 'Кнопка');
            commit(next);
          }}
        >
          + {lang === 'en' ? 'Button' : 'Кнопка'}
        </button>
      </div>

      <div style={{ fontSize: 10, color: 'var(--text3)' }}>
        {countButtons(model)} {lang === 'en' ? 'button(s)' : 'кн.'}
        {' · '}
        {model.rows.length} {lang === 'en' ? 'row(s)' : 'ряд(ов)'}
      </div>
    </div>
  );
}
