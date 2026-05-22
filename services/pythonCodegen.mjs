/**
 * Server bridge: Graph / stacks → aiogram 3 Python (единственный codegen target).
 */

import { projectGraphToFlow } from '../core/graph/model.js';
import { compileGraphToPython } from '../core/codegen/pipeline.js';
import { stacksToFlow } from '../core/codegen/stacksFlow.js';

/**
 * @param {unknown[]} stacks
 * @param {object} [options]
 */
export function compilePythonFromStacks(stacks, options = {}) {
  return compileGraphToPython(stacksToFlow(stacks), options);
}

/**
 * @param {object} projectGraph
 * @param {object} [options]
 */
export function compilePythonFromProjectGraph(projectGraph, options = {}) {
  const flow = projectGraphToFlow(projectGraph);
  return compileGraphToPython(flow, options);
}

/**
 * @param {unknown[]} stacks
 * @returns {string}
 */
export function generateBotPyFromStacks(stacks, options = {}) {
  return compilePythonFromStacks(stacks, options).code;
}
