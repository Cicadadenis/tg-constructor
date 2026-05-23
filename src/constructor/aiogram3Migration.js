/**
 * Helpers for migrating legacy Cicada modules and graphs to aiogram 3.
 */

const LEGACY_AIOGRAM_PATTERNS = [
  { pattern: /from\s+telegram\s+import\s+Bot,?\s*Dispatcher/gi, replace: 'from aiogram import Bot, Dispatcher' },
  { pattern: /from\s+aiogram\.dispatcher\s+import\s+Dispatcher/gi, replace: 'from aiogram import Dispatcher' },
  { pattern: /from\s+aiogram\.utils\s+import\s+executor/gi, replace: '# from aiogram.utils import executor (legacy aiogram 2 removed)' },
  { pattern: /executor\.start_polling\(/gi, replace: 'await dp.start_polling()' },
  { pattern: /register_message_handler\(/gi, replace: 'router.message.register(' },
  { pattern: /register_callback_query_handler\(/gi, replace: 'router.callback_query.register(' },
  { pattern: /register_inline_handler\(/gi, replace: 'router.inline_query.register(' },
  { pattern: /register_chosen_inline_handler\(/gi, replace: 'router.chosen_inline_result.register(' },
  { pattern: /dp\.register_message_handler\(/gi, replace: 'router.message.register(' },
  { pattern: /dp\.register_callback_query_handler\(/gi, replace: 'router.callback_query.register(' },
  { pattern: /dp\.register_inline_handler\(/gi, replace: 'router.inline_query.register(' },
  { pattern: /dp\.register_chosen_inline_handler\(/gi, replace: 'router.chosen_inline_result.register(' },
];

export function convertAiogram2To3(source) {
  if (typeof source !== 'string') return { source: String(source), warnings: ['Input converted to string.'] };
  let updated = source;
  const warnings = [];

  for (const { pattern, replace } of LEGACY_AIOGRAM_PATTERNS) {
    if (pattern.test(updated)) {
      updated = updated.replace(pattern, replace);
      warnings.push(`Replaced legacy pattern ${pattern}`);
    }
  }

  if (/executor\.start_polling\(/i.test(source)) {
    warnings.push('Legacy executor.start_polling() was converted to await dp.start_polling(); review runtime entrypoint semantics.');
  }

  if (/token\s*=\s*['\"]/i.test(updated) && !/Bot\(token=/i.test(updated)) {
    warnings.push('Found token assignment style; verify bot initialization for aiogram 3.');
  }

  return { source: updated, warnings };
}

export function migrateLegacyModule(moduleDefinition) {
  if (!moduleDefinition || typeof moduleDefinition !== 'object') {
    throw new Error('Expected module definition object');
  }

  const migrated = { ...moduleDefinition };
  if (typeof migrated.code === 'string') {
    const { source, warnings } = convertAiogram2To3(migrated.code);
    migrated.code = source;
    if (warnings.length) migrated.migrationWarnings = warnings;
  }

  if (migrated.runtime === 'aiogram2') {
    migrated.runtime = 'aiogram3';
    migrated.migrationWarnings = [...(migrated.migrationWarnings || []), 'Runtime changed from aiogram2 to aiogram3'];
  }

  return migrated;
}

export function migrateLegacyGraph(graph) {
  if (!graph || typeof graph !== 'object') return graph;
  const nodes = Array.isArray(graph.nodes) ? graph.nodes.map((node) => {
    if (!node || typeof node !== 'object') return node;
    const migrated = { ...node };
    if (typeof migrated.type === 'string') {
      if (migrated.type.includes('register_message_handler')) {
        migrated.type = 'router.message.register';
      }
      if (migrated.type.includes('register_callback_query_handler')) {
        migrated.type = 'router.callback_query.register';
      }
      if (migrated.type.includes('aiogram2')) {
        migrated.type = migrated.type.replace(/aiogram2/gi, 'aiogram3');
      }
    }
    return migrated;
  }) : graph.nodes;

  return {
    ...graph,
    nodes,
    runtime: graph.runtime === 'aiogram2' ? 'aiogram3' : graph.runtime,
  };
}
