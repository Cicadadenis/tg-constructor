#!/usr/bin/env node
/**
 * Snapshot project before local dev (excludes heavy dirs and secrets).
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKUP_DIR_NAME = '.dev-backups';
const DEFAULT_KEEP = 5;

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  '.git',
  BACKUP_DIR_NAME,
  'coverage',
  '.cache',
  '__pycache__',
  '.venv-esphome',
  '.cursor',
  'uploads',
]);

const SKIP_FILE_NAMES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
]);

function shouldSkip(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  const parts = norm.split('/').filter(Boolean);
  for (const part of parts) {
    if (SKIP_DIR_NAMES.has(part)) return true;
    if (part.startsWith('.venv')) return true;
    if (part.startsWith('.') && part !== '.gitkeep') return true;
  }
  const base = parts[parts.length - 1] || '';
  if (SKIP_FILE_NAMES.has(base)) return true;
  if (base.toLowerCase().includes('.env')) return true;
  if (base.endsWith('.pem') || base.endsWith('.key')) return true;
  return false;
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function pruneOldBackups(backupsRoot, keep) {
  let entries = [];
  try {
    entries = await fsp.readdir(backupsRoot, { withFileTypes: true });
  } catch {
    return;
  }
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  while (dirs.length > keep) {
    const oldest = dirs.shift();
    await fsp.rm(path.join(backupsRoot, oldest), { recursive: true, force: true });
  }
}

/**
 * @param {string} projectRoot
 * @returns {Promise<string>} absolute path to backup folder
 */
export async function createDevBackup(projectRoot) {
  const root = path.resolve(projectRoot);
  const backupsRoot = path.join(root, BACKUP_DIR_NAME);
  const dest = path.join(backupsRoot, stamp());
  await fsp.mkdir(dest, { recursive: true });

  const filter = (src) => {
    const rel = path.relative(root, src);
    if (!rel || rel === '') return true;
    if (rel.startsWith('..')) return false;
    return !shouldSkip(rel);
  };

  await fsp.cp(root, dest, {
    recursive: true,
    force: false,
    filter,
  });

  const keep = Math.max(1, Number(process.env.DEV_BACKUP_KEEP) || DEFAULT_KEEP);
  await pruneOldBackups(backupsRoot, keep);

  return dest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  createDevBackup(root)
    .then((p) => {
      console.log(p);
    })
    .catch((err) => {
      console.error('[dev-backup]', err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
