/**
 * Graph → Normalized AST → Validated AST → Python module (aiogram 3).
 */

import { registerAllBlockCompilers } from './blockCompilers/registerAll.js';
import { assertCompilableFlow } from '../ir/compileGate.js';
import {
  issuesToCompileErrors,
  validateAiogram3Graph,
} from '../rules/aiogram3RuleEngine.js';

registerAllBlockCompilers();
import { graphToNormalizedAst, normalizeGraphFlow } from './ast/normalize.js';
import { bindStacksForCodegen } from './ast/bindKeyboards.js';
import { buildCallbackMap } from './ast/callbackResolver.js';
import { assertValidAst } from './ast/validate.js';
import { CodegenError } from './errors.js';
import { validatePythonSyntax as validatePythonSyntaxStub } from './validatePython.stub.js';
import {
  flowToStacks,
  buildPythonModule,
  extractPythonHandlers,
  PYTHON_EXPORT_MODES,
} from './compileCore.js';
import { stacksToFlow } from './stacksFlow.js';
import { isFlowEmptyForCodegen } from './emptyGraph.js';
import { isGraphEffectivelyEmpty } from '../../src/constructor/graph_document/graph_canvas_state.js';
import { strictCompileValidation } from '../../src/constructor/graph_document/graph_validation_pipeline.js';
import {
  filterErrorsForStage,
  includeCallbacksInGraphGate,
  resolveOptionsStage,
  VALIDATION_STAGE,
} from '../../src/constructor/graph_document/validation_stages.js';

/**
 * @param {object} flow
 * @param {object} [options]
 * @returns {{ code: string, compileWarnings: string[], transpileTrace: object[], compileErrors: object[], ast: object[], empty?: boolean }}
 */
export function compileGraphToPython(flow, options = {}) {
  if (isFlowEmptyForCodegen(flow)) {
    return {
      code: '',
      compileWarnings: [],
      transpileTrace: [],
      compileErrors: [],
      ast: [],
      empty: true,
    };
  }

  if (options.graphDocument && isGraphEffectivelyEmpty(options.graphDocument)) {
    return {
      code: '',
      compileWarnings: [],
      transpileTrace: [],
      compileErrors: [],
      ast: [],
      empty: true,
    };
  }

  const validationStage = resolveOptionsStage(options);

  if (options.graphDocument && options.skipGraphGate !== true) {
    const gate = strictCompileValidation(options.graphDocument, {
      strict: validationStage === VALIDATION_STAGE.COMPILE,
      validationStage,
      includeCallbacks: includeCallbacksInGraphGate(validationStage),
    });
    if (!gate.ok && validationStage === VALIDATION_STAGE.COMPILE) {
      const gateIssues = gate.blocking?.length ? gate.blocking : (gate.errors || []);
      const compileErrors = gateIssues.map((d) => ({
        code: d.code || 'GRAPH_COMPILE_GATE',
        message: d.message,
        nodeId: d.nodeId,
        edgeId: d.edgeId,
      }));
      return {
        code: '',
        compileWarnings: [],
        transpileTrace: [],
        compileErrors,
        ast: [],
        aborted: true,
        compileBlocked: true,
        compileDiagnostics: gate.compileDiagnostics,
      };
    }
  }

  const transpileTrace = [];
  const compileWarnings = [];
  const compileErrors = [];

  let workingFlow = flow;
  const ruleResult = validateAiogram3Graph(flow, {
    autoFix: options.autoFix !== false && validationStage !== VALIDATION_STAGE.EDIT,
    validationStage,
  });
  for (const w of ruleResult.warnings) {
    compileWarnings.push(w.message);
  }
  const ruleErrors = filterErrorsForStage(
    issuesToCompileErrors(ruleResult.errors),
    validationStage,
  );
  if (!ruleResult.ok) {
    compileErrors.push(...ruleErrors);
    if (validationStage === VALIDATION_STAGE.COMPILE || options.strict === true) {
      return {
        code: '',
        compileWarnings,
        transpileTrace,
        compileErrors,
        ast: [],
        aborted: true,
        ruleViolations: ruleResult.errors,
      };
    }
  }
  if (ruleResult.stacksModified && ruleResult.flow) {
    workingFlow = ruleResult.flow;
  }

  try {
    const gate = assertCompilableFlow(workingFlow);
    if (gate.warnings?.length) compileWarnings.push(...gate.warnings);
  } catch (e) {
    if (options.strict !== false) {
      const msg = e?.errors?.length ? e.errors.join('\n') : (e?.message || String(e));
      compileErrors.push({ code: 'IR_VALIDATION', message: msg });
      return {
        code: '',
        compileWarnings,
        transpileTrace,
        compileErrors,
        ast: [],
        aborted: true,
      };
    }
    compileWarnings.push(e?.message ? String(e.message) : String(e));
  }

  let ast = [];
  try {
    ast = graphToNormalizedAst(workingFlow);
    assertValidAst(ast);
  } catch (e) {
    const err = e instanceof CodegenError ? e : new CodegenError(String(e?.message || e));
    compileErrors.push({
      code: err.code,
      message: err.message,
      blockType: err.blockType,
      nodeId: err.nodeId,
    });
    return { code: '', compileWarnings, transpileTrace, compileErrors, ast };
  }

  let stacks = [];
  if (ruleResult.stacksModified && ruleResult.stacks?.length) {
    stacks = ruleResult.stacks;
  } else if (ruleResult.stacks?.length) {
    stacks = ruleResult.stacks;
  } else {
    stacks = flowToStacks(workingFlow);
  }
  const bindResult = bindStacksForCodegen(stacks);
  if (!bindResult.ok) {
    compileErrors.push(...bindResult.errors.map((e) => ({
      code: e.code,
      message: e.message,
      blockType: e.blockType,
      nodeId: e.nodeId,
    })));
    if (options.strict !== false) {
      return {
        code: '',
        compileWarnings,
        transpileTrace,
        compileErrors,
        ast: [],
        aborted: true,
      };
    }
  }
  stacks = bindResult.stacks;

  const callbackCheck = buildCallbackMap(stacks, workingFlow);
  if (!callbackCheck.ok) {
    const cbIssues = callbackCheck.errors.map((e) => ({
      code: e.code || 'MissingCallbackHandlerError',
      message: e.message,
      nodeId: e.blockId,
      blockType: 'inline',
    }));
    const cbErrors = filterErrorsForStage(cbIssues, validationStage);
    if (validationStage === VALIDATION_STAGE.COMPILE || options.strict === true) {
      compileErrors.push(...cbErrors);
      if (cbErrors.length > 0) {
        return {
          code: '',
          compileWarnings,
          transpileTrace,
          compileErrors,
          ast: [],
          aborted: true,
        };
      }
    } else {
      for (const hint of cbIssues) {
        compileWarnings.push(hint.message);
      }
    }
  }

  const codegenCtx = { transpileTrace, storage: options.storage, flow: workingFlow };

  let code = '';
  try {
    code = buildPythonModule(stacks, { ...codegenCtx, compileWarnings });
  } catch (e) {
    const err = e instanceof CodegenError ? e : new CodegenError(String(e?.message || e));
    compileErrors.push({
      code: err.code,
      message: err.message,
      blockType: err.blockType,
      nodeId: err.nodeId,
    });
    return { code: '', compileWarnings, transpileTrace, compileErrors, ast, aborted: true };
  }

  if (compileErrors.length && (validationStage === VALIDATION_STAGE.COMPILE || options.strict === true)) {
    return { code: '', compileWarnings, transpileTrace, compileErrors, ast, aborted: true };
  }

  if (options.validatePython !== false && code) {
    const validateFn = options.validatePythonSyntax || validatePythonSyntaxStub;
    const pyCheck = validateFn(code);
    if (!pyCheck.ok) {
      compileErrors.push({
        code: 'PYTHON_SYNTAX',
        message: pyCheck.error || 'Python syntax validation failed',
      });
    }
  }

  if (options.exportMode === PYTHON_EXPORT_MODES.HANDLERS_ONLY) {
    code = extractPythonHandlers(code);
  }

  return {
    code,
    compileWarnings,
    transpileTrace,
    compileErrors,
    ast,
    graph: normalizeGraphFlow(workingFlow),
    ruleWarnings: ruleResult.warnings.map((w) => w.message),
    aborted: false,
  };
}

export function generatePythonWithMeta(flow, options = {}) {
  return compileGraphToPython(flow, options);
}

export function generatePythonFromFlow(flow, options = {}) {
  return compileGraphToPython(flow, options).code;
}

/** @param {unknown[]} stacks */
export function generatePythonWithMetaFromStacks(stacks, options = {}) {
  return compileGraphToPython(stacksToFlow(stacks), options);
}
