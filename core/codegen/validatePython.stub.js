/**
 * Browser-safe stub — py_compile runs only on the server (see validatePython.mjs).
 */

/**
 * @param {string} _code
 * @returns {{ ok: boolean, skipped?: boolean }}
 */
export function validatePythonSyntax(_code) {
  return { ok: true, skipped: true };
}
