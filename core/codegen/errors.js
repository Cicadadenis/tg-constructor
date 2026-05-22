/**
 * Python codegen errors — surfaced in Studio UI (no silent # unsupported).
 */

export class CodegenError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, blockType?: string, nodeId?: string }} [meta]
   */
  constructor(message, meta = {}) {
    super(message);
    this.name = 'CodegenError';
    this.code = meta.code || 'CODEGEN_ERROR';
    this.blockType = meta.blockType;
    this.nodeId = meta.nodeId;
  }
}

export class MissingCompilerError extends CodegenError {
  /** @param {string} blockType @param {string} [nodeId] */
  constructor(blockType, nodeId) {
    super(
      `Нет Python-компилятора для блока «${blockType}». Добавьте registerCompiler("${blockType}", fn) в codegen registry.`,
      { code: 'MISSING_COMPILER', blockType, nodeId },
    );
    this.name = 'MissingCompilerError';
  }
}

export class AstValidationError extends CodegenError {
  /** @param {string} message @param {object} [meta] */
  constructor(message, meta = {}) {
    super(message, { code: 'AST_VALIDATION', ...meta });
    this.name = 'AstValidationError';
  }
}

export class PythonSyntaxValidationError extends CodegenError {
  /** @param {string} message */
  constructor(message) {
    super(message, { code: 'PYTHON_SYNTAX' });
    this.name = 'PythonSyntaxValidationError';
  }
}

export class MissingCallbackHandlerError extends CodegenError {
  /**
   * @param {string} callbackData
   * @param {string} [nodeId]
   */
  constructor(callbackData, nodeId) {
    super(
      `Нет handler для callback_data «${callbackData}» — добавьте блок «При нажатии» (data / callbackPrefix) с телом handler`,
      { code: 'MissingCallbackHandlerError', blockType: 'callback', nodeId },
    );
    this.name = 'MissingCallbackHandlerError';
  }
}
