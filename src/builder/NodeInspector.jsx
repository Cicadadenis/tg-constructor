/**
 * NodeInspector — schema-driven double-click inspector.
 *
 * Reads operation contracts from the graph semantic registry and renders
 * editable fields, allowed inputs/outputs, and live validation feedback.
 * Mutates the graph exclusively through the GraphEditor dispatch API.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  describeAllowedConnections,
  getOperationContract,
  validateNodeProps,
} from '../constructor/graph_document/operation_registry.js';
import { getCompatibleBlockTypes } from '../constructor/block_catalog.js';
import { graphResolveNodeType } from '../app/graph/graphHelpers.js';
import { CompatibleBlocksHint } from './BuilderComponents.jsx';
import { AddBlockContext } from '../builderContext.js';
import { patchNodeData } from '../constructor/graph_document/graph_operation_client.js';
import {
  beginNodeEdit,
  endNodeEdit,
  markDraftField,
  commitNodeEdit,
} from '../constructor/graph_document/graph_edit_session.js';

const FIELD_INPUT_STYLE = {
  width: '100%',
  background: 'rgba(15,12,32,0.85)',
  border: '1px solid rgba(99,102,241,0.25)',
  borderRadius: 8,
  color: 'rgba(255,255,255,0.92)',
  fontSize: 12,
  padding: '8px 10px',
  fontFamily: 'var(--mono, ui-monospace, monospace)',
  outline: 'none',
};

const PORT_PILL_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 9px',
  borderRadius: 999,
  background: 'rgba(99,102,241,0.18)',
  border: '1px solid rgba(99,102,241,0.45)',
  color: 'rgba(199,210,254,0.95)',
  fontSize: 10.5,
  fontFamily: 'var(--mono, ui-monospace, monospace)',
};

const AUTOSAVE_DEBOUNCE_MS = 400;

function PortList({ title, ports }) {
  if (!ports?.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(199,210,254,0.55)' }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
          нет
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(199,210,254,0.55)' }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {ports.map((port) => (
          <span key={port.id} style={PORT_PILL_STYLE}>
            <span style={{ opacity: 0.6 }}>{port.kind}</span>
            <span>{port.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function NodeInspector({
  graph,
  nodeId,
  onClose,
  onDelete,
  onValidationToast,
}) {
  const document = graph?.getGraphDocument();
  const node = nodeId && document ? document.nodes[nodeId] : null;
  const resolvedType = useMemo(
    () => (node ? graphResolveNodeType(node) : null),
    [node?.type, node?.data?.type, node?.data?.blockType],
  );
  const contract = useMemo(
    () => (resolvedType ? getOperationContract(resolvedType) : null),
    [resolvedType],
  );
  const allowed = useMemo(
    () => (resolvedType ? describeAllowedConnections(resolvedType) : null),
    [resolvedType],
  );

  const [draft, setDraft] = useState(() => ({ ...(node?.data || {}) }));
  const [validation, setValidation] = useState(null);
  const [dirty, setDirty] = useState(false);
  const addBlock = React.useContext(AddBlockContext);
  const [quickAddWarning, setQuickAddWarning] = useState(null);

  const draftRef = useRef(draft);
  const dirtyKeysRef = useRef(new Set());
  const autosaveTimerRef = useRef(null);
  const activeNodeRef = useRef({ id: node?.id, type: node?.type });

  activeNodeRef.current = { id: node?.id, type: node?.type };

  const syncDraftState = useCallback((next) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  const markDirty = useCallback((key) => {
    dirtyKeysRef.current.add(key);
    setDirty(true);
  }, []);

  const clearDirty = useCallback(() => {
    dirtyKeysRef.current.clear();
    setDirty(false);
  }, []);

  const buildPatchFromDraft = useCallback((snapshot, keys) => {
    if (!contract) return {};
    const patch = {};
    const keyList = keys ?? contract.inspectorSchema.map((f) => f.key);
    for (const k of keyList) {
      if (Object.prototype.hasOwnProperty.call(snapshot, k)) {
        patch[k] = snapshot[k] ?? '';
      }
    }
    return patch;
  }, [contract]);

  const flushDirtyFields = useCallback((options = {}) => {
    const { nodeId: targetId, nodeType, closeAfter = false } = options;
    const targetNodeId = targetId ?? activeNodeRef.current.id;
    const targetType = nodeType ?? activeNodeRef.current.type;
    if (!targetNodeId || !targetType || !contract) return true;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const keys = dirtyKeysRef.current.size > 0
      ? [...dirtyKeysRef.current]
      : contract.inspectorSchema.map((f) => f.key);

    if (keys.length === 0) {
      if (closeAfter) onClose?.();
      return true;
    }

    const snapshot = { ...draftRef.current };
    const reason = validateNodeProps(targetType, snapshot);
    if (reason) {
      setValidation(reason);
      onValidationToast?.(reason, 'warning');
      return false;
    }

    setValidation(null);
    const patch = buildPatchFromDraft(snapshot, keys);
    if (Object.keys(patch).length > 0) {
      patchNodeData(graph, targetNodeId, patch);
    }
    commitNodeEdit(targetNodeId);
    clearDirty();
    if (closeAfter) onClose?.();
    return true;
  }, [graph, contract, buildPatchFromDraft, clearDirty, onClose, onValidationToast]);

  const safeClose = useCallback(() => {
    flushDirtyFields({ closeAfter: true });
  }, [flushDirtyFields]);

  const persistAll = useCallback(() => {
    if (!contract || !node) return;
    const snapshot = { ...draftRef.current };
    const reason = validateNodeProps(node.type, snapshot);
    if (reason) {
      setValidation(reason);
      onValidationToast?.(reason, 'warning');
      return;
    }
    setValidation(null);
    const patch = buildPatchFromDraft(snapshot);
    patchNodeData(graph, node.id, patch);
    clearDirty();
    onClose?.();
  }, [graph, node, contract, buildPatchFromDraft, clearDirty, onClose, onValidationToast]);

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      flushDirtyFields();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [flushDirtyFields]);

  const updateField = useCallback((key, value) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      draftRef.current = next;
      return next;
    });
    markDirty(key);
    markDraftField(node?.id, key);
    scheduleAutosave();
  }, [markDirty, scheduleAutosave, node?.id]);

  const persistField = useCallback((key, value) => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    setDraft((prev) => {
      const nextDraft = { ...prev, [key]: value };
      draftRef.current = nextDraft;
      const reason = validateNodeProps(node.type, nextDraft);
      if (reason) {
        setValidation(reason);
        onValidationToast?.(reason, 'warning');
        return prev;
      }
      setValidation(null);
      patchNodeData(graph, node.id, { [key]: value });
      dirtyKeysRef.current.delete(key);
      if (dirtyKeysRef.current.size === 0) setDirty(false);
      return nextDraft;
    });
  }, [graph, node, onValidationToast]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (nodeId) beginNodeEdit(nodeId);
    syncDraftState({ ...(node?.data || {}) });
    clearDirty();
    setValidation(null);
    return () => {
      if (nodeId) endNodeEdit(nodeId);
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      const { id, type } = activeNodeRef.current;
      if (!id || !type || !graph || dirtyKeysRef.current.size === 0) return;
      const leavingContract = getOperationContract(type);
      if (!leavingContract) return;
      const snapshot = { ...draftRef.current };
      const reason = validateNodeProps(type, snapshot);
      if (reason) return;
      const keys = [...dirtyKeysRef.current];
      const patch = {};
      for (const k of keys) {
        if (leavingContract.inspectorSchema.some((f) => f.key === k)) {
          patch[k] = snapshot[k] ?? '';
        }
      }
      if (Object.keys(patch).length > 0) {
        patchNodeData(graph, id, patch);
      }
    };
  }, [nodeId, node?.type, graph]);

  useEffect(() => {
    if (!node) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        safeClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [node, safeClose]);

  useEffect(() => () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
  }, []);

  if (!node || !contract) return null;

  const quickAdd = (type) => {
    setQuickAddWarning(null);
    const compatible = getCompatibleBlockTypes(resolvedType || graphResolveNodeType(node));
    if (!compatible.includes(type)) {
      setQuickAddWarning('Работает только после совместимого блока');
      return;
    }
    if (!flushDirtyFields()) return;
    if (addBlock) {
      addBlock(type);
      onClose?.();
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) safeClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 95000,
        background: 'rgba(2,3,12,0.66)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '6vh 16px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'linear-gradient(180deg, #0f0a25 0%, #07051a 100%)',
          border: '1px solid rgba(99,102,241,0.35)',
          borderRadius: 16,
          boxShadow: '0 28px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
          overflow: 'hidden',
          color: 'rgba(255,255,255,0.92)',
          fontFamily: 'Syne, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid rgba(99,102,241,0.25)',
            background: 'linear-gradient(90deg, rgba(99,102,241,0.18), transparent)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'rgba(199,210,254,0.65)',
                fontWeight: 700,
              }}
            >
              Inspector
            </span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{contract.type}</span>
            <span
              style={{
                fontSize: 9,
                padding: '3px 8px',
                borderRadius: 999,
                background: 'rgba(99,102,241,0.2)',
                border: '1px solid rgba(99,102,241,0.4)',
                color: 'rgba(199,210,254,0.95)',
              }}
            >
              {contract.category}
            </span>
            {dirty && (
              <span
                title="Несохранённые изменения"
                style={{
                  fontSize: 9,
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: 'rgba(251,191,36,0.15)',
                  border: '1px solid rgba(251,191,36,0.4)',
                  color: '#fde68a',
                }}
              >
                ● черновик
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={safeClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)',
              borderRadius: 8,
              width: 30,
              height: 30,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >✕</button>
        </div>

        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {contract.description && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
              {contract.description}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={() => quickAdd('message')} style={{ padding: '8px 12px', borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800 }}>Ответ ＋</button>
            <button type="button" onClick={() => quickAdd('buttons')} style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.28)', cursor: 'pointer', fontWeight: 700 }}>Кнопки ＋</button>
            <button type="button" onClick={() => quickAdd('stop')} style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', color: '#fecaca', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', fontWeight: 700 }}>Стоп</button>
          </div>
          {quickAddWarning && (
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(127,29,29,0.45)', color: 'rgba(254,202,202,0.95)', fontSize: 12 }}>
              ⚠ {quickAddWarning}
            </div>
          )}

          {contract.inspectorSchema.length === 0 ? (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
              Этот тип узла не имеет редактируемых полей.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {contract.inspectorSchema.map((field) => (
                <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span
                    style={{
                      fontSize: 9,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'rgba(199,210,254,0.55)',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {field.label}
                  </span>
                  {field.tag === 'textarea' ? (
                    <textarea
                      rows={field.rows || 3}
                      value={draft[field.key] ?? ''}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      onBlur={(e) => persistField(field.key, e.target.value)}
                      style={{ ...FIELD_INPUT_STYLE, resize: 'vertical' }}
                    />
                  ) : (
                    <input
                      type={field.secret ? 'password' : 'text'}
                      value={draft[field.key] ?? ''}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      onBlur={(e) => persistField(field.key, e.target.value)}
                      style={FIELD_INPUT_STYLE}
                    />
                  )}
                </label>
              ))}
            </div>
          )}

          {validation && (
            <div
              style={{
                fontSize: 11,
                color: 'rgba(254,202,202,0.95)',
                background: 'rgba(127,29,29,0.55)',
                border: '1px solid rgba(239,68,68,0.45)',
                borderRadius: 8,
                padding: '8px 10px',
              }}
            >
              ⚠ {validation}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
              padding: '10px 0 4px',
              borderTop: '1px dashed rgba(99,102,241,0.25)',
            }}
          >
            <PortList title="Входы" ports={allowed?.inputs} />
            <PortList title="Выходы" ports={allowed?.outputs} />
          </div>

          <div style={{ paddingTop: 12, borderTop: '1px dashed rgba(99,102,241,0.12)' }}>
            <div style={{ fontSize: 11, color: 'rgba(199,210,254,0.65)', marginBottom: 8 }}>Можно добавить ниже</div>
            <div style={{ maxHeight: 220, overflowY: 'auto', paddingRight: 6 }}>
              <CompatibleBlocksHint
                type={resolvedType || node.type}
                color="#60a5fa"
                mode="modal"
                onAdd={addBlock ? (t) => {
                  if (!flushDirtyFields()) return;
                  addBlock(t);
                  onClose?.();
                } : undefined}
              />
            </div>
          </div>

          {allowed?.maxOutputs != null && (
            <div style={{ fontSize: 10.5, color: 'rgba(199,210,254,0.6)' }}>
              Лимит исходящих рёбер: {allowed.maxOutputs}
            </div>
          )}
          {Array.isArray(allowed?.allowedTargetCategories) && allowed.allowedTargetCategories.length > 0 && (
            <div style={{ fontSize: 10.5, color: 'rgba(199,210,254,0.6)' }}>
              Допустимые категории получателей: {allowed.allowedTargetCategories.join(', ')}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
            padding: '12px 18px',
            borderTop: '1px solid rgba(99,102,241,0.2)',
            background: 'rgba(7,5,20,0.6)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (!flushDirtyFields()) return;
              onDelete?.(node.id);
              onClose?.();
            }}
            style={{
              background: 'rgba(127,29,29,0.45)',
              border: '1px solid rgba(239,68,68,0.55)',
              color: 'rgba(254,202,202,0.95)',
              borderRadius: 9,
              padding: '8px 14px',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'Syne, system-ui',
            }}
          >Удалить узел</button>
          <button
            type="button"
            onClick={safeClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.16)',
              color: 'rgba(255,255,255,0.9)',
              borderRadius: 9,
              padding: '8px 14px',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Syne, system-ui',
            }}
          >Закрыть</button>
          <button
            type="button"
            onClick={persistAll}
            style={{
              background: 'linear-gradient(135deg,#6366f1,#a855f7)',
              border: 'none',
              color: '#0a0a14',
              borderRadius: 9,
              padding: '8px 16px',
              fontSize: 11.5,
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'Syne, system-ui',
              boxShadow: '0 6px 20px rgba(99,102,241,0.45)',
            }}
          >Сохранить</button>
        </div>
      </div>
    </div>
  );
}
