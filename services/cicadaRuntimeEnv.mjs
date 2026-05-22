/**
 * Legacy Cicada core path resolver (cic-st-core removed).
 * Used only for optional sandbox ro-bind when an external checkout is configured.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

export function resolveCicadaCoreRoot() {
  const candidates = [
    process.env.CICADA_CORE_ROOT,
    process.env.CICADA_TG_ROOT,
    process.env.CICADA_CANONICAL_CORE,
    path.join(REPO_ROOT, 'cic-st-core', 'cicada'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const resolved = path.resolve(String(candidate));
    if (fs.existsSync(resolved)) return resolved;
  }
  return null;
}

export function resolveCicadaBin() {
  const fromEnv = process.env.CICADA_BIN;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  return null;
}
