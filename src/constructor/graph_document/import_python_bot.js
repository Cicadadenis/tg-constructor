/**
 * Graph editor command: importPythonBot(zip) — replace graph from aiogram3 Python sources.
 */

import { importPythonBot } from '../../../core/import/importPythonBot.ts';
import { migrateGraphDocument } from './graph_migration.js';

/**
 * Import aiogram3 bot from zip buffer into live graph editor (clear + bootstrap).
 * @param {object} graph — editor API with dispatch() / getGraphDocument()
 * @param {Buffer|Uint8Array|string} zip — .zip archive or raw .py source bytes
 * @returns {import('../../../core/import/importPythonBot.ts').ImportPythonBotResult & { applied?: boolean }}
 */
export function importPythonBotIntoGraph(graph, zip) {
  const result = importPythonBot(zip);
  if (!result.ok || !result.document) {
    return result;
  }

  const migrated = migrateGraphDocument(graph, result.document, { clear: true });
  if (!migrated?.ok) {
    return {
      ...result,
      ok: false,
      error: migrated?.error || 'graph_migration_failed',
    };
  }

  return {
    ...result,
    applied: true,
    document: graph.getGraphDocument?.() || result.document,
  };
}

export { importPythonBot };
