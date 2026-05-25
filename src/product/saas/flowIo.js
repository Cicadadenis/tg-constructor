/**
 * Flow import / export — production SaaS I/O.
 */

import { createGraphDocument } from '../../constructor/graph_document/graph_document.js';
import { validateGraphDocumentForEditor } from '../../constructor/graph_document/graph_validate.js';

/**
 * @param {object} graphDocument
 * @param {string} [filename]
 */
export function downloadFlowJson(graphDocument, filename = 'flow-export.json') {
  const validation = validateGraphDocumentForEditor(graphDocument);
  if (!validation.ok) {
    throw new Error(validation.errors[0]?.message || validation.issues?.[0]?.message || 'Invalid flow');
  }
  const payload = createGraphDocument(graphDocument);
  const data = JSON.stringify({
    schema_version: payload.schema_version,
    exported_at: new Date().toISOString(),
    nodes: Object.values(payload.nodes),
    edges: Object.values(payload.edges),
    metadata: payload.metadata,
    viewport: payload.viewport,
    ui_state: payload.ui_state,
  }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * @param {File} file
 * @returns {Promise<object>}
 */
export function parseFlowImportFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || '{}'));
        const rawDoc = data?.graph_document ?? data;
        const validation = validateGraphDocumentForEditor(rawDoc);
        if (!validation.ok) {
          reject(new Error(validation.errors[0]?.message || 'Invalid flow file'));
          return;
        }
        resolve(createGraphDocument(rawDoc));
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Invalid JSON'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Read failed'));
    reader.readAsText(file);
  });
}

/**
 * @returns {Promise<File | null>}
 */
export function pickFlowImportFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}
