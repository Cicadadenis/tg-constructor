import {
  generatePythonFromFlow,
  generatePythonWithMeta,
} from '../codegen/index.js';
import { validateFlow } from './flowValidate.js';
import { projectGraphToFlow } from './model.js';

export function generateDslFromProjectGraph() {
  throw new Error('DSL export removed — use generatePythonFromProjectGraph');
}

export function generatePythonFromProjectGraph(projectGraph, options = {}) {
  return generatePythonFromFlow(projectGraphToFlow(projectGraph), options);
}

export function generatePythonPreviewFromProjectGraph(projectGraph, options = {}) {
  return generatePythonWithMeta(projectGraphToFlow(projectGraph), options);
}

export function validateProjectGraphRuntime(projectGraph) {
  return validateFlow(projectGraphToFlow(projectGraph));
}
