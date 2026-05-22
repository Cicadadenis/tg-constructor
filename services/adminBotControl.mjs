import fs from 'fs';
import path from 'path';
import {
  startRunner,
  stopRunner,
  isRunnerActive,
  getRunnerStatus,
  getRunnerLogs,
} from './dslRunner.mjs';
import { generateBotPyFromStacks } from './pythonCodegen.mjs';
import { isPlaceholderBotToken } from '../core/botTokenPlaceholders.mjs';

const SAFE_USER_ID = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_CODE_BYTES = Number(process.env.DSL_MAX_CODE_BYTES || 100_000);

function normalizeMode(mode) {
  return mode === 'server' ? 'server' : 'sandbox';
}

function readNewestBotPyInDir(dir) {
  if (!fs.existsSync(dir)) return null;
  let best = null;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.py')) continue;
    const fp = path.join(dir, name);
    try {
      const st = fs.statSync(fp);
      if (!st.isFile()) continue;
      if (!best || st.mtimeMs > best.mtimeMs) {
        best = { fp, mtimeMs: st.mtimeMs };
      }
    } catch {
      // ignore
    }
  }
  if (!best) return null;
  return fs.readFileSync(best.fp, 'utf8');
}

export function enrichRunnerForAdmin(bot) {
  const remainingMs = Number.isFinite(bot.remainingMs)
    ? Math.max(0, bot.remainingMs)
    : Math.max(0, (bot.startedAt || 0) + (bot.timeoutMs || 0) - Date.now());
  const isServer = bot.mode === 'server';
  const sandboxMin = Math.max(1, Math.round((bot.timeoutMs || 5 * 60 * 1000) / 60000));
  return {
    ...bot,
    remainingMs,
    remainingSec: Math.ceil(remainingMs / 1000),
    runKind: isServer ? 'server' : 'sandbox',
    runLabel: isServer ? 'На сервере' : 'Тест (песочница)',
    runDetail: isServer
      ? (bot.runsUntil
        ? `до ${new Date(bot.runsUntil).toLocaleString('ru-RU')}`
        : 'пока активна подписка PRO')
      : `авто-стоп ~${sandboxMin} мин`,
  };
}

export async function resolveBotCode({ pool, botsDir, userId, mode, projectId }) {
  const slotMode = normalizeMode(mode);
  const status = getRunnerStatus(userId, slotMode);
  if (status?.file && fs.existsSync(status.file)) {
    return { code: fs.readFileSync(status.file, 'utf8'), source: 'running_process', projectId: status.projectId || projectId || null };
  }

  const runDir = path.join(botsDir, userId, `run-${slotMode}`);
  const fromDir = readNewestBotPyInDir(runDir);
  if (fromDir) {
    return { code: fromDir, source: 'run_directory', projectId: status?.projectId || projectId || null };
  }

  const pid = String(projectId || status?.projectId || '').trim();
  if (pid) {
    const { rows } = await pool.query(
      'SELECT stacks, user_id FROM projects WHERE id=$1 LIMIT 1',
      [pid],
    );
    if (rows[0] && String(rows[0].user_id) === String(userId)) {
      const stacks = typeof rows[0].stacks === 'string'
        ? JSON.parse(rows[0].stacks)
        : rows[0].stacks;
      if (Array.isArray(stacks) && stacks.length) {
        return { code: generateBotPyFromStacks(stacks), source: 'project_stacks', projectId: pid };
      }
    }
  }

  const { rows: latest } = await pool.query(
    `SELECT id, stacks FROM projects WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 1`,
    [userId],
  );
  if (latest[0]?.stacks) {
    const stacks = typeof latest[0].stacks === 'string'
      ? JSON.parse(latest[0].stacks)
      : latest[0].stacks;
    if (Array.isArray(stacks) && stacks.length) {
      return { code: generateBotPyFromStacks(stacks), source: 'latest_project', projectId: latest[0].id };
    }
  }

  return null;
}

function validateBotCode(code) {
  if (!code || typeof code !== 'string') {
    const err = new Error('Код бота не найден');
    err.statusCode = 404;
    throw err;
  }
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
    const err = new Error('Код слишком большой');
    err.statusCode = 400;
    throw err;
  }
  const tokenMatch = String(code).match(/^\s*бот\s+"([^"]*)"/m);
  const token = tokenMatch?.[1]?.trim() || '';
  if (!token) {
    const err = new Error('В коде нет строки: бот "TOKEN"');
    err.statusCode = 400;
    throw err;
  }
  if (isPlaceholderBotToken(token)) {
    const err = new Error('В коде шаблонный токен — нужен реальный токен BotFather');
    err.statusCode = 400;
    throw err;
  }
}

export async function adminStartUserBot({
  pool,
  botsDir,
  pythonBin,
  userId,
  mode,
  projectId,
  onEvent,
}) {
  if (!SAFE_USER_ID.test(String(userId))) {
    const err = new Error('Некорректный userId');
    err.statusCode = 400;
    throw err;
  }
  const slotMode = normalizeMode(mode);
  const resolved = await resolveBotCode({ pool, botsDir, userId, mode: slotMode, projectId });
  validateBotCode(resolved?.code);

  let runTimeoutMs;
  let runsUntil = null;
  let effectiveProjectId = String(projectId || resolved?.projectId || '').trim() || null;

  if (slotMode === 'server') {
    if (!effectiveProjectId) {
      const err = new Error('Для режима «сервер» укажите projectId');
      err.statusCode = 400;
      throw err;
    }
    const { rows } = await pool.query(
      'SELECT user_id FROM projects WHERE id=$1 LIMIT 1',
      [effectiveProjectId],
    );
    if (!rows[0] || String(rows[0].user_id) !== String(userId)) {
      const err = new Error('Проект не найден у этого пользователя');
      err.statusCode = 404;
      throw err;
    }
    const { rows: urows } = await pool.query(
      'SELECT subscription_exp FROM users WHERE id=$1 LIMIT 1',
      [userId],
    );
    const subExp = Number(urows[0]?.subscription_exp) || 0;
    runsUntil = subExp > Date.now() ? subExp : Date.now() + 24 * 60 * 60 * 1000;
    runTimeoutMs = Math.max(60_000, runsUntil - Date.now());
  }

  if (isRunnerActive(userId, slotMode)) {
    stopRunner(userId, { reason: 'admin_restart', mode: slotMode });
  }

  const meta = startRunner({
    userId,
    code: resolved.code,
    pythonBin,
    botsDir,
    mode: slotMode,
    runsUntil,
    timeoutMs: runTimeoutMs,
    projectId: slotMode === 'server' ? effectiveProjectId : null,
    onEvent,
  });

  return {
    status: 'started',
    mode: slotMode,
    projectId: effectiveProjectId,
    codeSource: resolved.source,
    autoStopIn: slotMode === 'server' ? null : Math.floor(meta.timeoutMs / 1000),
    runsUntil: meta.runsUntil ?? null,
  };
}

export async function adminRestartUserBot(ctx) {
  const mode = normalizeMode(ctx.mode);
  if (isRunnerActive(ctx.userId, mode)) {
    stopRunner(ctx.userId, { reason: 'admin_restart', mode });
  }
  return adminStartUserBot({ ...ctx, mode });
}

export function adminGetBotLogs(userId, mode, limitLines = 120) {
  return getRunnerLogs(userId, limitLines, normalizeMode(mode));
}
