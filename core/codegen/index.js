/**
 * Cicada Studio — aiogram 3 codegen (единственный execution target).
 * Visual Blocks → Graph JSON → IR → Python bot.py
 */

import { registerAllBlockCompilers } from './blockCompilers/registerAll.js';

registerAllBlockCompilers();

export {
  registerCompiler,
  getCompiler,
  compileBlock,
  listRegisteredCompilerTypes,
  getCompilerRegistrySnapshot,
  BLOCK_TO_PYTHON_COMPILER,
} from './registry.js';

export {
  CodegenError,
  MissingCompilerError,
  MissingCallbackHandlerError,
  AstValidationError,
  PythonSyntaxValidationError,
} from './errors.js';
export { buildCallbackMap, assertCallbackResolution } from './ast/callbackResolver.js';

export { compileBot, compileCommands, compileMain } from './moduleCompiler.js';
export { graphToNormalizedAst, normalizeGraphFlow } from './ast/normalize.js';
export { validateNormalizedAst, assertValidAst } from './ast/validate.js';
/** Browser-safe; server uses `validatePython.mjs` via `validatePythonSyntax` option or direct import. */
export { validatePythonSyntax } from './validatePython.stub.js';
export {
  compileGraphToPython,
  generatePythonWithMeta,
  generatePythonFromFlow,
  generatePythonWithMetaFromStacks,
} from './pipeline.js';

export { postProcessAiogramModule, scanHandlerResponseWarnings } from './postProcess.js';
export {
  applyKeyboardBinding,
  applyUiAttachmentsBinding,
  bindStacksForCodegen,
} from './ast/bindKeyboards.js';
export {
  validateAiogram3Graph,
  assertAiogram3GraphRules,
  issuesToCompileErrors,
} from '../rules/aiogram3RuleEngine.js';
export { AIOGRAM3_PIPELINE_STAGES } from '../rules/aiogram3BlockRoles.js';
export {
  transpileBlockToPython,
  transpileDslInterpolation,
  dslTextToPythonFString,
  transpileConditionExpr,
  DSL_TO_AIOGRAM_EXPR,
  compileNodeToPython,
  stackToPython,
  generatePythonFromStacks,
  extractPythonHandlers,
  PYTHON_EXPORT_MODES,
  blockToCodegenNode,
  flowToStacks,
  buildPythonModule,
} from './compileCore.js';
