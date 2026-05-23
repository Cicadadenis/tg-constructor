/**
 * Canvas persistence — GraphDocument only.
 */

import { createGraphDocument } from './graph_document.js';
import { importGraphDocument } from './graph_serializer.js';
import { validateGraphDocumentForEditor } from './graph_validate.js';

export function isGraphDocumentPayload(data) {
  return Boolean(
    data
    && (data.schema_version >= 1 || data.schemaVersion >= 1)
    && data.nodes
    && data.edges,
  );
}

export function loadPersistedCanvasBlob(raw) {
  if (!raw) return { document: createGraphDocument({}), legacy: false };
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (isGraphDocumentPayload(data)) {
    const { document } = importGraphDocument(data);
    const validated = validateGraphDocumentForEditor(document);
    return {
      document,
      legacy: false,
      viewport: data.viewport,
      validationFailed: !validated.ok,
      validationIssues: validated.errors,
      callbackHints: validated.callbackHints,
    };
  }
  throw new Error('Unsupported persisted canvas format: expected GraphDocument payload');
}

export function persistCanvasBlob(document) {
  const doc = createGraphDocument(document);
  const validated = validateGraphDocumentForEditor(doc);
  if (!validated.ok) {
    throw new Error(validated.errors[0]?.message || 'Graph validation failed before persist');
  }
  const edges = Object.values(doc.edges).filter((e) => !e.invalid);
  return {
    schema_version: doc.schema_version,
    nodes: Object.values(doc.nodes),
    edges,
    metadata: doc.metadata,
    viewport: doc.viewport,
    ui_state: doc.ui_state,
  };
}

