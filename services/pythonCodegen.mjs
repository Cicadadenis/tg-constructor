/**
 * Server bridge: Graph / stacks → aiogram 3 Python (graph compiler).
 */

import { projectGraphToFlow } from '../core/graph/model.js';
import { compileFlowToPython } from '../core/mappers/compileFlowGraph.mjs';
import { stacksToFlow } from '../core/codegen/stacksFlow.js';

/**
 * @param {unknown[]} stacks
 * @param {object} [_options]
 */
export function compilePythonFromStacks(stacks, _options = {}) {
  return compileFlowToPython(stacksToFlow(stacks));
}

/**
 * @param {object} projectGraph
 * @param {object} [_options]
 */
export function compilePythonFromProjectGraph(projectGraph, _options = {}) {
  const flow = projectGraphToFlow(projectGraph);
  return compileFlowToPython(flow);
}

/**
 * @param {unknown[]} stacks
 * @returns {string}
 */
export function generateBotPyFromStacks(stacks, options = {}) {
  return compilePythonFromStacks(stacks, options).code;
}
