import fs from 'fs';
import path from 'path';
import { isProduction } from '../core/env.mjs';
import { resolveCicadaCoreRoot } from './cicadaRuntimeEnv.mjs';

const SAFE_EXECUTABLE = /^(?:[a-zA-Z0-9_./:-]+)$/;
const DSL_MEDIA_DIR = path.resolve(process.env.DSL_MEDIA_DIR || '/var/www/cicada-studio/uploads/media');
const DSL_SANDBOX_MODE = String(
  process.env.DSL_SANDBOX_MODE || (isProduction() ? 'enforced' : 'auto'),
).trim().toLowerCase();
const DSL_CPU_SECONDS = Math.max(1, Number(process.env.DSL_CPU_SECONDS || 60));
const DSL_MEMORY_BYTES = Math.max(64 * 1024 * 1024, Number(process.env.DSL_MEMORY_BYTES || 512 * 1024 * 1024));
const DSL_MAX_PROCESSES = Math.max(8, Number(process.env.DSL_MAX_PROCESSES || 64));

/** @returns {'none' | 'isolated' | 'host'} */
export function resolveSandboxNetwork(override) {
  const raw = override ?? process.env.DSL_SANDBOX_NETWORK;
  if (raw != null && String(raw).trim() !== '') {
    return String(raw).trim().toLowerCase();
  }
  return isProduction() ? 'none' : 'host';
}

export function sandboxNetworkDisabled(network = resolveSandboxNetwork()) {
  return network === 'none' || network === 'isolated';
}

function executableExists(bin) {
  if (!bin || typeof bin !== 'string' || bin.includes('\0') || !SAFE_EXECUTABLE.test(bin)) return false;
  if (bin.includes('/')) return fs.existsSync(bin);
  const pathDirs = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  return pathDirs.some((dir) => fs.existsSync(path.join(dir, bin)));
}

export function sandboxExecutable() {
  if (process.platform !== 'linux') return null;
  if (executableExists('/usr/bin/bwrap')) return '/usr/bin/bwrap';
  if (executableExists('/bin/bwrap')) return '/bin/bwrap';
  if (executableExists('bwrap')) return 'bwrap';
  if (executableExists('/usr/bin/firejail')) return '/usr/bin/firejail';
  if (executableExists('firejail')) return 'firejail';
  return null;
}

function prlimitExecutable() {
  if (process.platform !== 'linux') return null;
  if (executableExists('/usr/bin/prlimit')) return '/usr/bin/prlimit';
  if (executableExists('/bin/prlimit')) return '/bin/prlimit';
  if (executableExists('prlimit')) return 'prlimit';
  return null;
}

function bwrapHostNetworkBinds(network) {
  if (sandboxNetworkDisabled(network)) return [];
  return [
    '--ro-bind-try', '/etc/resolv.conf', '/etc/resolv.conf',
    '--ro-bind-try', '/etc/hosts', '/etc/hosts',
    '--ro-bind-try', '/etc/nsswitch.conf', '/etc/nsswitch.conf',
    '--ro-bind-try', '/etc/gai.conf', '/etc/gai.conf',
  ];
}

function bwrapCicadaCoreBinds() {
  const coreRoot = resolveCicadaCoreRoot();
  if (!coreRoot || !fs.existsSync(coreRoot)) return [];
  return [
    ...bwrapParentDirs(coreRoot),
    '--ro-bind', coreRoot, coreRoot,
  ];
}

function bwrapMediaBinds() {
  if (!fs.existsSync(DSL_MEDIA_DIR)) return [];
  const dirs = [];
  let current = DSL_MEDIA_DIR;
  while (current && current !== path.dirname(current)) {
    dirs.push(current);
    current = path.dirname(current);
  }
  dirs.reverse();
  return [
    ...dirs.slice(0, -1).flatMap((dir) => ['--dir', dir]),
    '--ro-bind', DSL_MEDIA_DIR, DSL_MEDIA_DIR,
  ];
}

function bwrapRoBindDir(targetDir) {
  const resolved = path.resolve(String(targetDir || ''));
  if (!resolved || !fs.existsSync(resolved)) return [];
  return [
    ...bwrapParentDirs(resolved),
    '--ro-bind', resolved, resolved,
  ];
}

/** Read-only bwrap bind for the whole per-user bots tree (media, projects, etc.). */
export function botRunnerMediaBindDirs(botsDir, userId) {
  const safeUserId = String(userId || '').trim();
  if (!botsDir || !/^[a-zA-Z0-9_-]{1,64}$/.test(safeUserId)) return [];
  const root = path.resolve(botsDir, safeUserId);
  return fs.existsSync(root) ? [root] : [];
}

function bwrapParentDirs(targetDir) {
  const resolved = path.resolve(targetDir);
  const dirs = [];
  let current = path.dirname(resolved);
  while (current && current !== path.dirname(current)) {
    dirs.push(current);
    current = path.dirname(current);
  }
  return dirs.reverse().flatMap((dir) => ['--dir', dir]);
}

/**
 * @param {{ bin: string, args: string[], workDir: string, network?: string, requireSandbox?: boolean, extraRoBindDirs?: string[] }} opts
 */
export function buildSandboxedChildCommand({
  bin,
  args,
  workDir,
  network = resolveSandboxNetwork(),
  requireSandbox = DSL_SANDBOX_MODE === 'enforced' || DSL_SANDBOX_MODE === 'auto',
  extraRoBindDirs = [],
}) {
  const roBindDirs = [...new Set((extraRoBindDirs || []).map((dir) => path.resolve(String(dir || ''))).filter(Boolean))];
  if (!executableExists(bin)) throw new Error(`invalid executable: ${bin}`);
  const sandbox = sandboxExecutable();
  const prlimit = prlimitExecutable();
  let command = bin;
  let spawnArgs = [...args];
  let sandboxed = false;

  if (sandbox && path.basename(sandbox) === 'bwrap') {
    command = sandbox;
    spawnArgs = [
      '--die-with-parent',
      '--new-session',
      ...(sandboxNetworkDisabled(network) ? ['--unshare-net'] : []),
      '--proc', '/proc',
      '--dev', '/dev',
      '--tmpfs', '/tmp',
      '--ro-bind', '/usr', '/usr',
      '--ro-bind', '/bin', '/bin',
      '--ro-bind-try', '/lib', '/lib',
      '--ro-bind-try', '/lib64', '/lib64',
      '--ro-bind-try', '/etc/ssl', '/etc/ssl',
      ...bwrapHostNetworkBinds(network),
      ...bwrapMediaBinds(),
      ...roBindDirs.flatMap((dir) => bwrapRoBindDir(dir)),
      ...bwrapCicadaCoreBinds(),
      ...bwrapParentDirs(workDir),
      '--bind', workDir, workDir,
      '--chdir', workDir,
      bin,
      ...args,
    ];
    sandboxed = true;
  } else if (sandbox && path.basename(sandbox) === 'firejail') {
    command = sandbox;
    spawnArgs = [
      '--quiet',
      ...(sandboxNetworkDisabled(network) ? ['--net=none'] : []),
      ...roBindDirs.flatMap((dir) => (fs.existsSync(dir) ? [`--whitelist=${dir}`] : [])),
      '--private-dev',
      '--rlimit-nproc=64',
      `--rlimit-as=${DSL_MEMORY_BYTES}`,
      `--timeout=00:00:${Math.max(1, DSL_CPU_SECONDS)}`,
      '--',
      bin,
      ...args,
    ];
    sandboxed = true;
  } else if (requireSandbox) {
    throw new Error('DSL sandbox is required but bwrap/firejail is not available');
  }

  if (prlimit) {
    spawnArgs = [
      `--cpu=${DSL_CPU_SECONDS}`,
      `--as=${DSL_MEMORY_BYTES}`,
      `--nproc=${DSL_MAX_PROCESSES}`,
      '--',
      command,
      ...spawnArgs,
    ];
    command = prlimit;
  }

  return { command, args: spawnArgs, sandboxed, limited: Boolean(prlimit), network };
}
