#!/usr/bin/env node
/**
 * Build guard — aiogram 3 AST-first codegen only (no cic-st-core / .ccd runtime).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const REQUIRED = [
  'core/codegen/pipeline.js',
  'core/rules/aiogram3RuleEngine.js',
  'core/graph/flowPorts.js',
];

const FORBIDDEN = [
  'cic-st-core',
  'src/ccdParser.js',
  'core/dslCodegen.js',
  'core/validator',
];

function main() {
  const failures = [];
  for (const rel of REQUIRED) {
    if (!fs.existsSync(path.join(REPO_ROOT, rel))) {
      failures.push({ type: 'missing', path: rel });
    }
  }
  for (const rel of FORBIDDEN) {
    if (fs.existsSync(path.join(REPO_ROOT, rel))) {
      failures.push({ type: 'forbidden-legacy', path: rel });
    }
  }
  if (failures.length) {
    console.error(JSON.stringify({ ok: false, failures }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({
    ok: true,
    policy: 'aiogram3 AST-first codegen only; Cicada/.ccd runtime removed',
    required: REQUIRED,
  }, null, 2));
}

main();
