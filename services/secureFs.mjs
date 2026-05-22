import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;

export function resolveUnderRoot(rootDir, ...segments) {
  const root = path.resolve(rootDir);
  const parts = segments.flatMap((s) => String(s || '').split(/[/\\]+/)).filter(Boolean);
  for (const part of parts) {
    if (part === '..' || part === '.' || !SAFE_SEGMENT.test(part)) {
      throw new Error('invalid path segment');
    }
  }
  const target = path.resolve(root, ...parts);
  const common = path.relative(root, target);
  if (common.startsWith('..') || path.isAbsolute(common)) {
    throw new Error('path outside sandbox');
  }
  return target;
}

export async function atomicWriteFile(filePath, data, encoding = 'utf8') {
  const dir = path.dirname(filePath);
  await fsp.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  await fsp.writeFile(tmp, data, { encoding, flag: 'wx' });
  await fsp.rename(tmp, filePath);
}

export async function readFileUtf8(filePath, maxBytes = 16 * 1024 * 1024) {
  const st = await fsp.lstat(filePath);
  if (!st.isFile()) throw new Error('not a regular file');
  if (st.size > maxBytes) throw new Error('file too large');
  return fsp.readFile(filePath, 'utf8');
}

export function lstatNoFollow(filePath) {
  return fsp.lstat(filePath, { bigint: false });
}
