/**
 * Optional post-codegen diagnostics (no keyboard patching, no callback stubs).
 */

const HANDLER_DEF_RE = /@router\.[^(]+\([^)]*\)\s*\nasync def (\w+)/g;

function handlerHasTelegramOutput(body) {
  return (
    /\.answer\s*\(/.test(body)
    || /\.edit_message_text\s*\(/.test(body)
    || /\.edit_text\s*\(/.test(body)
    || /\.answer_photo\s*\(/.test(body)
    || /\.answer_document\s*\(/.test(body)
    || /callback\.answer\s*\(/.test(body)
  );
}

/** Warn when handler body has no outbound Telegram call. */
export function scanHandlerResponseWarnings(source) {
  const warnings = [];
  const re = /@router\.[^\n]+\nasync def (\w+)\([^)]*\):\n([\s\S]*?)(?=\n@router\.|\nasync def [a-z_]+\(|\nif __name__|$)/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const name = m[1];
    const body = m[2];
    if (!handlerHasTelegramOutput(body)) {
      warnings.push(
        `Handler ${name} does not call message.answer(), edit_message_text, or callback.answer() — users may see no response.`,
      );
    }
  }
  return warnings;
}

function ensureAiogramStructure(source, warnings) {
  if (!/dp\s*=\s*Dispatcher\s*\(\s*\)/.test(source)) {
    warnings.push('Generated module missing dp = Dispatcher().');
  }
  if (!/router\s*=\s*Router\s*\(\s*\)/.test(source)) {
    warnings.push('Generated module missing router = Router().');
  }
  if (!/dp\.include_router\s*\(\s*router\s*\)/.test(source)) {
    warnings.push('Generated module missing dp.include_router(router) in main().');
  }
}

/**
 * @param {string} source
 * @returns {{ code: string, warnings: string[] }}
 */
export function postProcessAiogramModule(source) {
  const warnings = [];
  let code = String(source || '');
  if (!code.trim()) return { code, warnings };
  ensureAiogramStructure(code, warnings);
  warnings.push(...scanHandlerResponseWarnings(code));
  return { code, warnings };
}
