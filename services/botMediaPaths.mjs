import fs from 'fs';
import path from 'path';
import { PROJECT_ID_RE } from './projectId.mjs';

const LEGACY_MEDIA_DIR = path.resolve(process.env.DSL_MEDIA_DIR || '/var/www/cicada-studio/uploads/media');

const MEDIA_PATH_PATTERNS = [
  /(\/var\/www\/cicada-studio\/bots\/[a-zA-Z0-9_-]{1,64}\/projects\/[a-zA-Z0-9_-]{1,128}\/media\/[^\s"']+)/g,
  /(\/var\/www\/cicada-studio\/bots\/[a-zA-Z0-9_-]{1,64}\/media\/[^\s"']+)/g,
  /(\/var\/www\/cicada-studio\/uploads\/media\/[^\s"']+)/g,
];

function listMediaSearchDirs(botsDir, userId, projectId) {
  const dirs = [];
  const userRoot = path.resolve(botsDir, userId);
  const pid = String(projectId || '').trim();
  if (pid && PROJECT_ID_RE.test(pid)) {
    dirs.push(path.join(userRoot, 'projects', pid, 'media'));
  }
  const projectsRoot = path.join(userRoot, 'projects');
  if (fs.existsSync(projectsRoot)) {
    for (const name of fs.readdirSync(projectsRoot)) {
      if (!PROJECT_ID_RE.test(name)) continue;
      const dir = path.join(projectsRoot, name, 'media');
      if (fs.existsSync(dir) && !dirs.includes(dir)) dirs.push(dir);
    }
  }
  dirs.push(path.join(userRoot, 'media'));
  if (fs.existsSync(LEGACY_MEDIA_DIR)) dirs.push(LEGACY_MEDIA_DIR);
  return dirs;
}

function newestFileWithExtension(dir, ext) {
  let best = null;
  let bestMtime = 0;
  for (const name of fs.readdirSync(dir)) {
    if (ext && !name.endsWith(ext)) continue;
    const fp = path.join(dir, name);
    try {
      const st = fs.statSync(fp);
      if (!st.isFile() || st.mtimeMs <= bestMtime) continue;
      bestMtime = st.mtimeMs;
      best = fp;
    } catch {
      // ignore
    }
  }
  return best;
}

function resolveMissingMediaPath(resolved, searchDirs, projectId) {
  const base = path.basename(resolved);
  for (const dir of searchDirs) {
    const candidate = path.join(dir, base);
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }
  const pid = String(projectId || '').trim();
  if (!pid || !PROJECT_ID_RE.test(pid)) return null;
  const isEphemeralUserMedia = /\/bots\/[^/]+\/media\//.test(resolved)
    && !resolved.includes('/projects/');
  if (!isEphemeralUserMedia) return null;
  const ext = path.extname(resolved);
  const projectDirs = searchDirs.filter((dir) => dir.includes(`${path.sep}projects${path.sep}`));
  for (const dir of projectDirs) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).filter((name) => !ext || name.endsWith(ext));
      if (files.length === 1) return path.join(dir, files[0]);
      const newest = newestFileWithExtension(dir, ext);
      if (newest) return newest;
    } catch {
      // ignore
    }
  }
  return null;
}

/** If a DSL media path is missing, try the same basename in project/user/legacy media dirs. */
export function normalizeMediaPathsInCode(code, { botsDir, userId, projectId } = {}) {
  if (!code || !userId || !botsDir) return code;
  const searchDirs = listMediaSearchDirs(botsDir, userId, projectId);
  let out = String(code);
  for (const re of MEDIA_PATH_PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, (match) => {
      const resolved = path.resolve(match);
      try {
        if (fs.existsSync(resolved)) return match;
      } catch {
        return match;
      }
      const replacement = resolveMissingMediaPath(resolved, searchDirs, projectId);
      return replacement || match;
    });
  }
  return out;
}
