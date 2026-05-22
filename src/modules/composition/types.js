/**
 * @typedef {object} GraphModuleMergeStrategy
 * @property {boolean} [dedupeBot]
 * @property {boolean} [dedupeStart]
 * @property {'first_wins'|'reuse'|'merge'|'warn'} [mergeGlobals]
 * @property {boolean} [mergeMenus]
 * @property {'foundation'|'fragment'} [placement]
 */

/**
 * @typedef {object} GraphModuleManifest
 * @property {string} id
 * @property {number} version
 * @property {string} [name]
 * @property {string} [category]
 * @property {string[]} dependencies
 * @property {string[]} capabilities
 * @property {string[]} globals
 * @property {string[]} callbacks
 * @property {string[]} [commands]
 * @property {GraphModuleMergeStrategy} mergeStrategy
 * @property {{ nodes: object[], edges: object[] }} graph
 * @property {Record<string, string>} [exports]
 * @property {string[]} [imports]
 */

/**
 * @typedef {object} ModuleComposeConflict
 * @property {string} kind — 'callback'|'global'|'bot'|'start'|'dependency'
 * @property {string} code
 * @property {string} message
 * @property {string} [moduleId]
 * @property {string} [existing]
 * @property {string} [incoming]
 * @property {string} [resolution]
 */

/**
 * @typedef {object} ModuleComposeFix
 * @property {string} kind
 * @property {string} message
 * @property {string} [from]
 * @property {string} [to]
 */

/**
 * @typedef {object} ModuleComposeReport
 * @property {string[]} moduleIds
 * @property {string[]} resolvedDependencies
 * @property {ModuleComposeConflict[]} conflicts
 * @property {ModuleComposeFix[]} fixes
 * @property {object[]} diagnostics
 * @property {boolean} ok
 */

/**
 * @typedef {object} ModuleComposeResult
 * @property {boolean} ok
 * @property {import('../../constructor/graph_document/graph_document.js').GraphDocument|null} document
 * @property {ModuleComposeReport} report
 * @property {string} [error]
 */

export {};
