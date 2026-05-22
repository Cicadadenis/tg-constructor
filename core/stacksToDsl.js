/**
 * Studio codegen barrel — aiogram 3 Python only.
 */
export {
  transpileBlockToPython,
  compileNodeToPython,
  stackToPython,
  generatePythonFromStacks,
  generatePythonFromFlow,
  generatePythonWithMeta,
  generatePythonWithMetaFromStacks,
  extractPythonHandlers,
  PYTHON_EXPORT_MODES,
  DSL_TO_AIOGRAM_EXPR,
  BLOCK_TO_PYTHON_COMPILER,
  compileGraphToPython,
  registerCompiler,
} from './codegen/index.js';

export {
  validateFlow,
  canRenderUi,
  inferRequiredFeaturesFromFlow,
  inferRequiredFeaturesFromStacks,
  buildProjectGraphDocumentFromFlow,
  buildProjectGraphDocumentFromStacks,
  SCHEMA_VERSIONS_FOR_UI,
} from './graphStudio.js';
