/**
 * Validate generated Python via py_compile.
 * Run: node core/codegen/validatePython.mjs "<code>"
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * @param {string} code
 * @returns {{ ok: boolean, error?: string }}
 */
export function validatePythonSyntax(code) {
  const dir = mkdtempSync(join(tmpdir(), 'cicada-codegen-'));
  const file = join(dir, 'bot.py');
  try {
    writeFileSync(file, String(code || ''), 'utf8');
    const py = process.env.PYTHON || 'python';
    const r = spawnSync(py, ['-m', 'py_compile', file], { encoding: 'utf8' });
    if (r.status === 0) return { ok: true };
    return { ok: false, error: (r.stderr || r.stdout || 'py_compile failed').trim() };
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  const code = process.argv[2] || '';
  const result = validatePythonSyntax(code);
  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }
  console.log('ok');
}
