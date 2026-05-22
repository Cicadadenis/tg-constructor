import fs from 'fs';
import path from 'path';

const SAFE_USER_ID = /^[a-zA-Z0-9_-]{1,64}$/;
const RUNNER_MODES = ['sandbox', 'server'];
const ORPHAN_MEDIA_MIN_AGE_MS = Number(process.env.ORPHAN_MEDIA_MIN_AGE_MS || 60_000);
const ORPHAN_RUNNER_MIN_AGE_MS = Number(process.env.ORPHAN_RUNNER_MIN_AGE_MS || 5 * 60_000);

function isEphemeralUserMediaFile(resolved, botsRoot) {
  return resolved.startsWith(botsRoot + path.sep)
    && resolved.includes(`${path.sep}media${path.sep}`)
    && !resolved.includes(`${path.sep}projects${path.sep}`);
}

function isLegacyMediaFile(resolved, legacyMediaDir) {
  return resolved.startsWith(legacyMediaDir + path.sep);
}

/**
 * Remove ephemeral media not referenced by active runs and older than min age.
 */
export function cleanupOrphanMedia({
  botsDir,
  legacyMediaDir,
  activeMediaPaths = new Set(),
  minAgeMs = ORPHAN_MEDIA_MIN_AGE_MS,
} = {}) {
  const botsRoot = path.resolve(botsDir || 'bots');
  const legacyRoot = path.resolve(legacyMediaDir || 'uploads/media');
  const protectedPaths = new Set(
    [...activeMediaPaths].map((p) => path.resolve(String(p || ''))).filter(Boolean),
  );
  const now = Date.now();
  let removed = 0;

  const sweepDir = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const filePath = path.join(dir, name);
      let st;
      try {
        st = fs.statSync(filePath);
      } catch {
        continue;
      }
      if (!st.isFile()) continue;
      const resolved = path.resolve(filePath);
      if (protectedPaths.has(resolved)) continue;
      if (now - st.mtimeMs < minAgeMs) continue;
      if (!isLegacyMediaFile(resolved, legacyRoot) && !isEphemeralUserMediaFile(resolved, botsRoot)) {
        continue;
      }
      try {
        fs.unlinkSync(resolved);
        removed += 1;
      } catch {
        // ignore per-file errors
      }
    }
  };

  sweepDir(legacyRoot);
  if (fs.existsSync(botsRoot)) {
    for (const userId of fs.readdirSync(botsRoot)) {
      if (!SAFE_USER_ID.test(userId)) continue;
      sweepDir(path.join(botsRoot, userId, 'media'));
    }
  }

  return removed;
}

/**
 * Remove stale bot artifacts in run-* dirs when no runner is active for that slot.
 */
export function cleanupOrphanRunners({
  botsDir,
  isRunnerActive,
  minAgeMs = ORPHAN_RUNNER_MIN_AGE_MS,
} = {}) {
  if (typeof isRunnerActive !== 'function') return 0;
  const botsRoot = path.resolve(botsDir || 'bots');
  if (!fs.existsSync(botsRoot)) return 0;

  const now = Date.now();
  let removed = 0;

  for (const userId of fs.readdirSync(botsRoot)) {
    if (!SAFE_USER_ID.test(userId)) continue;
    for (const mode of RUNNER_MODES) {
      if (isRunnerActive(userId, mode)) continue;
      const runDir = path.join(botsRoot, userId, `run-${mode}`);
      if (!fs.existsSync(runDir)) continue;
      for (const name of fs.readdirSync(runDir)) {
        if (!name.endsWith('.py') && !name.endsWith('.json')) continue;
        const filePath = path.join(runDir, name);
        let st;
        try {
          st = fs.statSync(filePath);
        } catch {
          continue;
        }
        if (now - st.mtimeMs < minAgeMs) continue;
        try {
          fs.unlinkSync(filePath);
          removed += 1;
        } catch {
          // ignore
        }
      }
    }
  }

  return removed;
}

export function runSystemCleanup(ctx) {
  const mediaRemoved = cleanupOrphanMedia(ctx);
  const runnerRemoved = cleanupOrphanRunners(ctx);
  return { mediaRemoved, runnerRemoved };
}
