/**
 * UI-level validation hooks.
 * Called before: hydrate, save, export, example load.
 * GraphDocument is the only input.
 */

export { validateGraph } from '../../constructor/graph_document/validate_graph.js';
export { validateGraphDocumentForEditor } from '../../constructor/graph_document/graph_validate.js';

/**
 * Run pre-save validation and throw on failure.
 * @param {object} graphDocument
 * @param {string} [context] — 'save' | 'export' | 'example'
 */
import { validateGraph as validateGraphDocument } from '../../constructor/graph_document/validate_graph.js';

export function assertGraphValid(graphDocument, context = 'save') {
  const result = validateGraphDocument(graphDocument, { context });
  if (!result.ok) {
    throw new Error(result.issues[0]?.message || `Graph validation failed (${context})`);
  }
}
