import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Venv or site-packages with aiogram for bot runner / py_compile. */
export function resolveBotPythonRoot() {
  const candidates = [
    process.env.BOT_PYTHON_VENV,
    process.env.PYTHON_VENV,
    path.join(REPO_ROOT, '.venv-bot'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    const site = process.platform === 'win32'
      ? path.join(resolved, 'Lib', 'site-packages')
      : path.join(resolved, 'lib', `python${process.version.match(/^v(\d+\.\d+)/)?.[1] || '3'}`, 'site-packages');
    if (fs.existsSync(path.join(site, 'aiogram'))) return resolved;
    if (fs.existsSync(path.join(resolved, 'bin', 'python')) || fs.existsSync(path.join(resolved, 'Scripts', 'python.exe'))) {
      return resolved;
    }
  }
  return null;
}

/** PYTHONPATH / env for child processes running generated bot.py. */
export function botPythonEnv(base = {}) {
  const venvRoot = resolveBotPythonRoot();
  const sep = path.delimiter;
  const extra = venvRoot
    ? (process.platform === 'win32'
      ? [path.join(venvRoot, 'Lib', 'site-packages')]
      : [path.join(venvRoot, 'lib', `python${process.version.match(/^v(\d+\.\d+)/)?.[1] || '3'}`, 'site-packages')])
    : [];
  const pythonPath = [...extra, base.PYTHONPATH, process.env.PYTHONPATH].filter(Boolean).join(sep);
  return {
    ...base,
    PYTHONPATH: pythonPath || undefined,
    PYTHONUTF8: '1',
    PYTHONIOENCODING: 'utf-8',
    PYTHONUNBUFFERED: '1',
  };
}

export function pythonCmd() {
  const fromEnv = process.env.PYTHON || process.env.PYTHON3 || process.env.PYTHON_BIN;
  if (fromEnv) return fromEnv;
  const venv = resolveBotPythonRoot();
  if (venv) {
    const win = path.join(venv, 'Scripts', 'python.exe');
    const nix = path.join(venv, 'bin', 'python3');
    if (fs.existsSync(win)) return win;
    if (fs.existsSync(nix)) return nix;
  }
  if (process.platform === 'win32') return 'python';
  if (fs.existsSync('/usr/bin/python3')) return '/usr/bin/python3';
  return 'python3';
}
