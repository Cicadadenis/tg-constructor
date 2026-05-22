/**
 * Graph-native module registry — composable manifests (not DSL code strings).
 */

import { adminCheckManifest } from './manifests/admin_check.js';
import { adminMenuManifest } from './manifests/admin_menu.js';
import { broadcastAllManifest } from './manifests/broadcast_all.js';
import { adminStatsManifest } from './manifests/admin_stats.js';

/** @type {Record<string, import('../composition/types.js').GraphModuleManifest>} */
export const GRAPH_MODULE_REGISTRY = Object.freeze({
  [adminCheckManifest.id]: adminCheckManifest,
  [adminMenuManifest.id]: adminMenuManifest,
  [broadcastAllManifest.id]: broadcastAllManifest,
  [adminStatsManifest.id]: adminStatsManifest,
});

export const GRAPH_MODULE_IDS = Object.freeze(Object.keys(GRAPH_MODULE_REGISTRY));

/**
 * @param {string} moduleId
 * @returns {import('../composition/types.js').GraphModuleManifest|null}
 */
export function getGraphModule(moduleId) {
  return GRAPH_MODULE_REGISTRY[moduleId] || null;
}

/**
 * @param {string} moduleId
 */
export function isGraphNativeModule(moduleId) {
  return Boolean(GRAPH_MODULE_REGISTRY[moduleId]);
}

/**
 * Modules that can be composed together (admin suite).
 */
export const GRAPH_MODULE_SUITES = Object.freeze({
  admin_suite: ['admin_by_id', 'admin_menu', 'broadcast_all', 'user_count'],
});
