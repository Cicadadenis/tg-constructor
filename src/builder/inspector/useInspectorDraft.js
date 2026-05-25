import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getOperationContract,
  validateNodeProps,
} from '../../constructor/graph_document/operation_registry.js';
import { patchNodeData } from '../../constructor/graph_document/graph_operation_client.js';
import {
  beginNodeEdit,
  commitNodeEdit,
  endNodeEdit,
  markDraftField,
} from '../../constructor/graph_document/graph_edit_session.js';

const AUTOSAVE_DEBOUNCE_MS = 280;

/**
 * Live reactive draft for the right-side inspector (no modal save step).
 * @param {object} params
 * @param {object} params.graph
 * @param {string | null} params.nodeId
 * @param {string | null} params.nodeType
 * @param {(message: string, type?: string) => void} [params.onValidationToast]
 * @param {number} [params.graphRevision] — re-sync draft when graph updates externally
 */
export function useInspectorDraft({ graph, nodeId, nodeType, onValidationToast, graphRevision }) {
  const contract = nodeType ? getOperationContract(nodeType) : null;

  const [draft, setDraft] = useState({});
  const [validation, setValidation] = useState(null);
  const [dirty, setDirty] = useState(false);

  const draftRef = useRef(draft);
  const dirtyKeysRef = useRef(new Set());
  const autosaveTimerRef = useRef(null);
  const activeRef = useRef({ nodeId, nodeType });

  activeRef.current = { nodeId, nodeType };

  const syncDraft = useCallback((next) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  const clearDirty = useCallback(() => {
    dirtyKeysRef.current.clear();
    setDirty(false);
  }, []);

  const buildPatch = useCallback((snapshot, keys) => {
    if (!contract) return {};
    const patch = {};
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(snapshot, k)) {
        patch[k] = snapshot[k] ?? '';
      }
    }
    return patch;
  }, [contract]);

  const flushDirtyFields = useCallback((options = {}) => {
    const targetId = options.nodeId ?? activeRef.current.nodeId;
    const targetType = options.nodeType ?? activeRef.current.nodeType;
    if (!targetId || !targetType || !contract) return true;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const keys = dirtyKeysRef.current.size > 0
      ? [...dirtyKeysRef.current]
      : contract.inspectorSchema.map((f) => f.key);

    if (!keys.length) return true;

    const snapshot = { ...draftRef.current };
    const reason = validateNodeProps(targetType, snapshot);
    if (reason) {
      setValidation(reason);
      onValidationToast?.(reason, 'error');
      return false;
    }

    setValidation(null);
    const patch = buildPatch(snapshot, keys);
    if (Object.keys(patch).length > 0) {
      patchNodeData(graph, targetId, patch);
      commitNodeEdit(targetId);
    }
    clearDirty();
    return true;
  }, [graph, contract, buildPatch, clearDirty, onValidationToast]);

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
    dirtyKeysRef.current.add(key);
    setDirty(true);
    if (nodeId) markDraftField(nodeId, key);
    scheduleAutosave();
  }, [nodeId, scheduleAutosave]);

  const persistField = useCallback((key, value) => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      draftRef.current = next;
      const reason = validateNodeProps(nodeType, next);
      if (reason) {
        setValidation(reason);
        onValidationToast?.(reason, 'error');
        return prev;
      }
      setValidation(null);
      if (nodeId) {
        patchNodeData(graph, nodeId, { [key]: value });
        commitNodeEdit(nodeId);
      }
      dirtyKeysRef.current.delete(key);
      if (dirtyKeysRef.current.size === 0) setDirty(false);
      return next;
    });
  }, [graph, nodeId, nodeType, onValidationToast]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!nodeId) {
      syncDraft({});
      clearDirty();
      setValidation(null);
      return undefined;
    }

    const doc = graph?.getGraphDocument?.();
    const node = doc?.nodes?.[nodeId];
    beginNodeEdit(nodeId);
    syncDraft({ ...(node?.data || {}) });
    clearDirty();
    setValidation(null);

    return () => {
      endNodeEdit(nodeId);
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      const { nodeId: id, nodeType: type } = activeRef.current;
      if (!id || !type || dirtyKeysRef.current.size === 0) return;
      const leaving = getOperationContract(type);
      if (!leaving) return;
      const snapshot = { ...draftRef.current };
      const reason = validateNodeProps(type, snapshot);
      if (reason) return;
      const patch = {};
      for (const k of dirtyKeysRef.current) {
        if (leaving.inspectorSchema.some((f) => f.key === k)) {
          patch[k] = snapshot[k] ?? '';
        }
      }
      if (Object.keys(patch).length > 0) {
        patchNodeData(graph, id, patch);
      }
    };
  }, [nodeId, nodeType, graph, syncDraft, clearDirty]);

  useEffect(() => {
    if (!nodeId || dirtyKeysRef.current.size > 0) return;
    const node = graph?.getGraphDocument?.()?.nodes?.[nodeId];
    if (!node) return;
    syncDraft({ ...(node.data || {}) });
  }, [graphRevision, nodeId, graph, syncDraft]);

  useEffect(() => () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
  }, []);

  return {
    contract,
    draft,
    validation,
    dirty,
    updateField,
    persistField,
    flushDirtyFields,
  };
}
