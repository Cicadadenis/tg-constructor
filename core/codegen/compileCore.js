/**
 * Cicada graph blocks → Python 3 / aiogram 3 codegen (новое ядро).
 * CCD DSL → AST/Graph → transpileBlockToPython() → исполняемый aiogram Python.
 * Не генерирует legacy DSL runtime.
 */

import { normalizeFlowNode } from '../ir/normalizeFlowNode.js';
import { assertCompilableFlow } from '../ir/compileGate.js';
import {
  isConditionLikeType,
  balanceConditionParens,
} from '../dslCondition.js';
import {
  isEventHandlerType,
  isRootChunkType,
} from './constants.js';
import { ROLE_FSM } from '../rules/aiogram3BlockRoles.js';
import { compileBlock, getCompiler, BLOCK_TO_PYTHON_COMPILER } from './registry.js';
import { isStacksEmptyForCodegen } from './emptyGraph.js';
import { bindStacksForCodegen } from './ast/bindKeyboards.js';
import { boundKeyboardParts, getAnswerTarget } from './ast/keyboardMarkup.js';
import { assertCallbackResolution, collectRequiredCallbackData } from './ast/callbackResolver.js';
import { CodegenError } from './errors.js';
import {
  parseButtonRows,
  parseInlineRows,
  emitReplyKeyboard,
  emitInlineKeyboard,
} from './keyboards.js';
import { callbackKeysMatch, normalizeCallbackData } from './callbackDataNormalize.js';

export { parseButtonRows, parseInlineRows, emitReplyKeyboard, emitInlineKeyboard } from './keyboards.js';

/** @typedef {{ indent?: number, handlerNames?: Set<string>, blockNames?: Set<string>, storage?: 'fsm_pop' | 'fsm_update_data', handlerPath?: string[], inCallbackHandler?: boolean, transpileTrace?: object[], fsmStates?: Map<string, Set<string>>, askFields?: Map<string, string> }} PythonCodegenContext */

/** DSL-переменные → выражения aiogram. */
export const DSL_TO_AIOGRAM_EXPR = Object.freeze({
  'пользователь.имя': 'message.from_user.first_name',
  'пользователь.id': 'message.from_user.id',
  'пользователь.username': 'message.from_user.username',
  'пользователь.фамилия': 'message.from_user.last_name',
  'пользователь.last_name': 'message.from_user.last_name',
  'пользователь.first_name': 'message.from_user.first_name',
  'сообщение.text': 'message.text',
  'сообщение.текст': 'message.text',
  'текст': 'message.text',
  'сообщение.id': 'message.message_id',
  'чат.id': 'message.chat.id',
  'chat.id': 'message.chat.id',
  'chat_id': 'message.chat.id',
  'кнопка': 'callback.data',
  'callback.data': 'callback.data',
  'файл_id': 'message.document.file_id',
  'имя_файла': 'message.document.file_name',
});

const DSL_BUILTIN_FUNCS = [
  ['начинается_с', (args) => `${args[0]}.startswith(${args[1]})`],
  ['содержит_элемент', (args) => `${args[1]} in ${args[0]}`],
  ['добавить', (args) => `${args[0]}.append(${args[1]})`],
  ['тип', (args) => `type(${args[0]}).__name__`],
  ['длина', (args) => `len(${args[0]})`],
  ['срез', (args) => (args[1] != null ? `${args[0]}[${args[1]}:]` : `${args[0]}[:]`)],
];

// --- utilities ---

function byPosition(a, b) {
  const dy = (a.position?.y || 0) - (b.position?.y || 0);
  if (dy !== 0) return dy;
  return (a.position?.x || 0) - (b.position?.x || 0);
}

function topoSortNodes(nodes, edges) {
  const list = nodes || [];
  const idToNode = new Map(list.map((n) => [n.id, n]));
  const adj = new Map();
  const indeg = new Map();
  for (const n of list) {
    adj.set(n.id, []);
    indeg.set(n.id, 0);
  }
  for (const e of edges || []) {
    if (!idToNode.has(e.source) || !idToNode.has(e.target)) continue;
    adj.get(e.source).push(e.target);
    indeg.set(e.target, indeg.get(e.target) + 1);
  }
  const ready = list.filter((n) => indeg.get(n.id) === 0);
  ready.sort(byPosition);
  const out = [];
  while (ready.length) {
    const cur = ready.shift();
    out.push(cur);
    for (const t of adj.get(cur.id) || []) {
      indeg.set(t, indeg.get(t) - 1);
      if (indeg.get(t) === 0) {
        ready.push(idToNode.get(t));
        ready.sort(byPosition);
      }
    }
  }
  if (out.length < list.length) {
    const seen = new Set(out.map((x) => x.id));
    out.push(...list.filter((x) => !seen.has(x.id)).sort(byPosition));
  }
  return out;
}

function pyIndent(level) {
  return '    '.repeat(Math.max(0, level));
}

function pyQuote(s) {
  const raw = String(s ?? '');
  if (raw.includes('"') && !raw.includes("'")) return `'${raw}'`;
  return `"${raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

function escapePyKey(key) {
  const k = String(key ?? '').trim();
  if (/^[A-Za-z_\u0400-\u04FF][\w\u0400-\u04FF]*$/.test(k)) return k;
  return pyQuote(k);
}

function toPyIdent(name) {
  return (
    String(name || 'unnamed')
      .trim()
      .replace(/[^\w\u0400-\u04FF]+/gu, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase() || 'unnamed'
  );
}

function toPascalCase(name) {
  return (
    toPyIdent(name)
      .split('_')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('') || 'Scenario'
  );
}

function blockFuncName(name) {
  return `block_${toPyIdent(name)}`;
}

function scenarioStateRef(scenario, step) {
  const cls = toPascalCase(scenario || 'Scenario');
  const st = toPyIdent(step || 'step');
  return `${cls}.${st}`;
}

export function transpileDslInterpolation(text) {
  const src = String(text ?? '');
  return src.replace(/\{([^{}]+)\}/g, (_m, inner) => {
    const key = String(inner).trim();
    const mapped = DSL_TO_AIOGRAM_EXPR[key];
    if (mapped) return `{${mapped}}`;
    return `{${key}}`;
  });
}

export function dslTextToPythonFString(text) {
  const body = transpileDslInterpolation(text);
  if (!body.includes('{')) return pyQuote(body);
  return `f${pyQuote(body)}`;
}

function dslRhsToPython(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 'None';
  if (/^-?\d+(\.\d+)?$/.test(raw)) return raw;
  // normalize boolean literals coming from UI (true/false) to Python booleans
  if (raw.toLowerCase() === 'true') return 'True';
  if (raw.toLowerCase() === 'false') return 'False';
  if (raw === '[]' || raw === '{}') return raw;
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw;
  }
  if (/^[\w\u0400-\u04FF][\w\u0400-\u04FF.]*$/.test(raw)) {
    const mapped = DSL_TO_AIOGRAM_EXPR[raw];
    if (mapped) return mapped;
    return raw;
  }
  return dslTextToPythonFString(raw);
}

function splitTopLevelArgs(inner) {
  const args = [];
  let cur = '';
  let depth = 0;
  let inStr = null;
  for (let i = 0; i < inner.length; i += 1) {
    const c = inner[i];
    if (inStr) {
      cur += c;
      if (c === inStr && inner[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
      cur += c;
      continue;
    }
    if (c === '(') depth += 1;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (c === ',' && depth === 0) {
      args.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

function transpileDslCallExpr(expr, ctx = {}) {
  const m = String(expr).trim().match(/^([\w\u0400-\u04FF]+)\s*\((.*)\)\s*$/su);
  if (!m) return null;
  const fnName = m[1];
  const builtin = DSL_BUILTIN_FUNCS.find(([name]) => name === fnName);
  if (!builtin) return null;
  const args = splitTopLevelArgs(m[2]).map((a) => transpileConditionExpr(a, ctx));
  return builtin[1](args);
}

export function transpileConditionExpr(cond, ctx = {}) {
  let s = balanceConditionParens(String(cond || '').replace(/:?\s*$/, ''));
  for (const [dsl, py] of Object.entries(DSL_TO_AIOGRAM_EXPR)) {
    const re = new RegExp(`\\b${dsl.replace(/\./g, '\\.')}\\b`, 'gu');
    s = s.replace(re, py);
  }
  if (ctx.inCallbackHandler && /\bкнопка\b/u.test(s) && !s.includes('callback.data')) {
    s = s.replace(/\bкнопка\b/gu, 'callback.data');
  }
  s = s
    .replace(/\bистина\b/gu, 'True')
    .replace(/\bложь\b/gu, 'False')
    .replace(/\bи\b/gu, 'and')
    .replace(/\bили\b/gu, 'or')
    .replace(/\bне\b/gu, 'not ')
    .replace(/\s+содержит\s+/gu, ' in ')
    .replace(/\s+начинается_с\s+/gu, '.startswith(');
  for (let pass = 0; pass < 8; pass += 1) {
    const replaced = transpileDslCallExpr(s, ctx);
    if (!replaced || replaced === s) break;
    s = replaced;
  }
  return s.trim();
}

function defaultHandlerName(type, props = {}) {
  const map = {
    start: 'handle_start',
    command: `handle_command_${String(props.cmd || 'cmd').replace(/^\//, '').replace(/\W/g, '_')}`,
    callback: props.label
      ? `handle_press_${toPyIdent(props.label)}`
      : props.dataPrefix
        ? `handle_cb_${toPyIdent(props.dataPrefix)}`
        : 'handle_callback',
    on_text: 'handle_text',
    on_voice: 'handle_voice',
    voice_received: 'handle_voice',
    on_sticker: 'handle_sticker',
    sticker_received: 'handle_sticker',
    on_photo: 'handle_photo',
    photo_received: 'handle_photo',
    on_document: 'handle_document',
    document_received: 'handle_document',
    on_location: 'handle_location',
    location_received: 'handle_location',
    on_contact: 'handle_contact',
    contact_received: 'handle_contact',
    else: 'fallback_handler',
  };
  return map[type] || `handle_${type}`;
}

function uniqueHandlerName(base, ctx) {
  const names = ctx.handlerNames ?? new Set();
  let name = base;
  let i = 2;
  while (names.has(name)) {
    name = `${base}_${i}`;
    i += 1;
  }
  names.add(name);
  ctx.handlerNames = names;
  return name;
}

function recordTranspileTrace(ctx, block, compilerName, code) {
  if (!ctx?.transpileTrace) return;
  ctx.transpileTrace.push({
    nodeId: block?.id ?? block?.props?.nodeId ?? null,
    blockType: block?.type || 'unknown',
    generatedPython: String(code || '').trim(),
    compilerName: compilerName || block?.type || 'unknown',
  });
}

// --- output + bound keyboard (AST attach model) ---

function compileOutputLine(block, ctx, lineBuilder) {
  const ind = pyIndent(ctx.indent);
  const { prelude, suffix } = boundKeyboardParts(block, ctx);
  const line = `${ind}${lineBuilder(suffix)}`;
  return prelude ? `${prelude}\n${line}` : line;
}

// --- block compilers ---

export function compileReply(block, ctx) {
  const text = block?.props?.text ?? block?.payload?.text ?? '';
  const expr = dslTextToPythonFString(text);
  const target = getAnswerTarget(ctx);
  return compileOutputLine(block, ctx, (suffix) => `await ${target}.answer(${expr}${suffix})`);
}

/** Keyboards bind at AST phase — standalone keyboard blocks emit nothing. */
export function compileButtons() {
  return '';
}

export function compileInline() {
  return '';
}

export function compileInlineDb() {
  return '';
}

export function compileDeleteKey(block, ctx) {
  const key = block?.props?.key ?? block?.payload?.key ?? '';
  const storage = ctx.storage ?? 'fsm_pop';
  const ind = pyIndent(ctx.indent);
  if (storage === 'fsm_update_data') {
    return `${ind}await state.update_data(${escapePyKey(key)}=None)`;
  }
  const k = pyQuote(String(key).trim());
  return [
    `${ind}data = await state.get_data()`,
    `${ind}data.pop(${k}, None)`,
    `${ind}await state.set_data(data)`,
  ].join('\n');
}

export function compileEventDecorator(type, props = {}, ctx = {}) {
  switch (type) {
    case 'on_voice':
    case 'voice_received':
      return '@router.message(F.voice)';
    case 'on_sticker':
    case 'sticker_received':
      return '@router.message(F.sticker)';
    case 'on_text':
      return '@router.message(StateFilter(None), F.text)';
    case 'on_photo':
    case 'photo_received':
      return '@router.message(F.photo)';
    case 'on_document':
    case 'document_received':
      return '@router.message(F.document)';
    case 'on_location':
    case 'location_received':
      return '@router.message(F.location)';
    case 'on_contact':
    case 'contact_received':
      return '@router.message(F.contact)';
    case 'start':
      return '@router.message(CommandStart())';
    case 'command': {
      const cmd = String(props.cmd || 'start').replace(/^\//, '');
      return `@router.message(Command(${pyQuote(cmd)}))`;
    }
    case 'callback': {
      const data = normalizeCallbackData(props.data || props.callbackData || '');
      const prefix = normalizeCallbackData(props.dataPrefix || props.callbackPrefix || '');
      const label = normalizeCallbackData(props.label || '');
      const inlineCallbacks = ctx.inlineCallbackData;
      if (data) {
        return `@router.callback_query(F.data == ${pyQuote(data)})`;
      }
      if (prefix) {
        return `@router.callback_query(F.data.startswith(${pyQuote(prefix)}))`;
      }
      if (label && inlineCallbacks?.size) {
        for (const cb of inlineCallbacks) {
          if (callbackKeysMatch(cb, label)) {
            return `@router.callback_query(F.data == ${pyQuote(cb)})`;
          }
        }
      }
      if (label) {
        return `@router.message(F.text == ${pyQuote(label)})`;
      }
      return '@router.callback_query()';
    }
    case 'else':
      return '@router.message()';
    default:
      return '@router.message()';
  }
}

export function compileVoiceEvent(block, ctx) {
  return compileEventDecorator('on_voice', block?.props, ctx);
}
export function compileStickerEvent(block, ctx) {
  return compileEventDecorator('on_sticker', block?.props, ctx);
}
export function compileTextEvent(block, ctx) {
  return compileEventDecorator('on_text', block?.props, ctx);
}
export function compilePhotoEvent(block, ctx) {
  return compileEventDecorator('on_photo', block?.props, ctx);
}
export function compileDocumentEvent(block, ctx) {
  return compileEventDecorator('on_document', block?.props, ctx);
}
export function compileLocationEvent(block, ctx) {
  return compileEventDecorator('on_location', block?.props, ctx);
}
export function compileContactEvent(block, ctx) {
  return compileEventDecorator('on_contact', block?.props, ctx);
}
export function compileStartEvent(block, ctx) {
  return compileEventDecorator('start', block?.props, ctx);
}
export function compileCommandEvent(block, ctx) {
  return compileEventDecorator('command', block?.props, ctx);
}
export function compileCallbackEvent(block, ctx) {
  return compileEventDecorator('callback', block?.props, ctx);
}
export function compileElseEvent(block, ctx) {
  return compileEventDecorator('else', block?.props, ctx);
}

export function compileRemember(block, ctx) {
  const varname = escapePyKey(block?.props?.varname || 'var');
  const value = dslRhsToPython(block?.props?.value);
  return `${pyIndent(ctx.indent)}${varname} = ${value}`;
}

export function compileGet(block, ctx) {
  const key = block?.props?.key || '';
  const varname = escapePyKey(block?.props?.varname || 'var');
  const ind = pyIndent(ctx.indent);
  const k = pyQuote(String(key).trim());
  return [
    `${ind}data = await state.get_data()`,
    `${ind}${varname} = data.get(${k})`,
  ].join('\n');
}

export function compileSave(block, ctx) {
  const key = block?.props?.key || '';
  const value = dslRhsToPython(block?.props?.value);
  const ind = pyIndent(ctx.indent);
  const k = escapePyKey(String(key).trim());
  return `${ind}await state.update_data(${k}=${value})`;
}

export function compileSaveGlobal(block, ctx) {
  const key = block?.props?.key || '';
  const value = dslRhsToPython(block?.props?.value);
  const ind = pyIndent(ctx.indent);
  return `${ind}GLOBAL_STORE[${pyQuote(String(key).trim())}] = ${value}`;
}

export function compileSetGlobal(block, ctx) {
  const varname = escapePyKey(block?.props?.varname || 'var');
  const value = dslRhsToPython(block?.props?.value);
  return `${pyIndent(ctx.indent)}${varname} = ${value}`;
}

export function compileAsk(block, ctx) {
  const question = dslTextToPythonFString(block?.props?.question || '');
  const field = toPyIdent(block?.props?.varname || 'field');
  const formField = `Form.${field}`;
  if (ctx.fsmStates) {
    if (!ctx.fsmStates.has('Form')) ctx.fsmStates.set('Form', new Set());
    ctx.fsmStates.get('Form').add(field);
  }
  const ind = pyIndent(ctx.indent);
  const target = getAnswerTarget(ctx);
  const { prelude, suffix } = boundKeyboardParts(block, ctx);
  const answer = `${ind}await ${target}.answer(${question}${suffix})`;
  const lines = [prelude, answer, `${ind}await state.set_state(${formField})`].filter(Boolean);
  return lines.join('\n');
}

export function compileHttp(block, ctx) {
  const p = block?.props || {};
  const method = String(p.method || 'GET').toUpperCase();
  const url = dslTextToPythonFString(p.url || '');
  const varname = escapePyKey(p.varname || 'result');
  const ind = pyIndent(ctx.indent);
  if (method === 'GET') {
    return [
      `${ind}async with aiohttp.ClientSession() as session:`,
      `${ind}    async with session.get(${url}) as response:`,
      `${ind}        ${varname} = await response.json()`,
    ].join('\n');
  }
  return `${ind}# http ${method}: not fully codegen'd yet`;
}

export function compileDocumentSend(block, ctx) {
  const fileId = dslRhsToPython(block?.props?.url || block?.props?.file_id || 'file_id');
  const captionKw = mediaCaptionKwarg(block);
  const target = getAnswerTarget(ctx);
  return compileOutputLine(block, ctx, (suffix) => `await ${target}.answer_document(${fileId}${captionKw}${suffix})`);
}

export function compileGoto(block, ctx) {
  const target = block?.props?.target ?? block?.props?.label ?? 'main';
  const parts = String(target).split(/[./]/).filter(Boolean);
  const scenario = parts[0] || 'Scenario';
  const step = parts[1] || parts[0] || 'step';
  const ref = parts.length > 1 ? scenarioStateRef(scenario, step) : scenarioStateRef('Scenario', scenario);
  return `${pyIndent(ctx.indent)}await state.set_state(${ref})`;
}

export function compileUse(block, ctx) {
  const name = blockFuncName(block?.props?.blockname || block?.props?.name || 'block');
  return `${pyIndent(ctx.indent)}await ${name}(message, state)`;
}

export function compileRun(block, ctx) {
  return compileGoto(
    { props: { target: block?.props?.name || block?.props?.scenario || block?.props?.target } },
    ctx,
  );
}

export function compileStop(block, ctx) {
  const ind = pyIndent(ctx.indent);
  const reason = block?.props?.reason || '';
  if (reason === 'scenario') return `${ind}await state.clear()`;
  if (reason === 'return') {
    const val = block?.props?.value;
    return val ? `${ind}return ${dslRhsToPython(val)}` : `${ind}return`;
  }
  if (reason === 'break' || reason === 'continue') {
    return `${ind}${reason}`;
  }
  return `${ind}return`;
}

export function compileLoop(block, ctx) {
  const p = block?.props || {};
  const mode = p.mode || 'count';
  const ind = pyIndent(ctx.indent);
  if (mode === 'foreach') {
    const v = escapePyKey(p.var || 'item');
    const coll = dslRhsToPython(p.collection || 'items');
    return `${ind}for ${v} in ${coll}:`;
  }
  if (mode === 'while') {
    return `${ind}while ${transpileConditionExpr(p.cond || 'True', ctx)}:`;
  }
  const count = Number(p.count) || 3;
  return `${ind}for _ in range(${count}):`;
}

export function compileDelay(block, ctx) {
  const sec = block?.props?.seconds || '1';
  return `${pyIndent(ctx.indent)}await asyncio.sleep(${Number(sec) || 1})`;
}

export function compileTyping(block, ctx) {
  const sec = block?.props?.seconds || '1';
  const ind = pyIndent(ctx.indent);
  return `${ind}await message.chat.do("typing")\n${ind}await asyncio.sleep(${Number(sec) || 1})`;
}

export function compileLog(block, ctx) {
  const level = block?.props?.level || 'info';
  const msg = dslTextToPythonFString(block?.props?.message || '');
  return `${pyIndent(ctx.indent)}logging.${level}(${msg})`;
}

export function compileCondition(block, ctx) {
  const cond = transpileConditionExpr(block?.props?.cond || 'True', ctx);
  return `${pyIndent(ctx.indent)}if ${cond}:`;
}

export function compileConditionNot(block, ctx) {
  const cond = transpileConditionExpr(block?.props?.cond || 'True', ctx);
  return `${pyIndent(ctx.indent)}if not (${cond}):`;
}

export function compileElse(block, ctx) {
  return `${pyIndent(ctx.indent)}else:`;
}

function mediaCaptionKwarg(block) {
  const caption = String(block?.props?.caption ?? '').trim();
  if (!caption) return '';
  return `, caption=${dslTextToPythonFString(caption)}`;
}

function compileMediaAnswer(method, block, ctx) {
  const url = dslRhsToPython(block?.props?.url || block?.props?.file_id || '""');
  const captionKw = mediaCaptionKwarg(block);
  const target = getAnswerTarget(ctx);
  return compileOutputLine(block, ctx, (suffix) => `await ${target}.answer_${method}(${url}${captionKw}${suffix})`);
}

export function compilePhoto(block, ctx) {
  return compileMediaAnswer('photo', block, ctx);
}
export function compileVideo(block, ctx) {
  return compileMediaAnswer('video', block, ctx);
}
export function compileAudio(block, ctx) {
  return compileMediaAnswer('audio', block, ctx);
}
export function compileSticker(block, ctx) {
  const fid = dslRhsToPython(block?.props?.file_id || '');
  const target = getAnswerTarget(ctx);
  return compileOutputLine(block, ctx, (suffix) => `await ${target}.answer_sticker(${fid}${suffix})`);
}
export function compileContact(block, ctx) {
  const p = block?.props || {};
  const target = getAnswerTarget(ctx);
  return compileOutputLine(
    block,
    ctx,
    (suffix) =>
      `await ${target}.answer_contact(phone_number=${pyQuote(p.phone || '')}, first_name=${pyQuote(p.first_name || '')}${suffix})`,
  );
}
export function compileLocation(block, ctx) {
  const p = block?.props || {};
  const target = getAnswerTarget(ctx);
  return compileOutputLine(
    block,
    ctx,
    (suffix) =>
      `await ${target}.answer_location(latitude=${Number(p.lat) || 0}, longitude=${Number(p.lon) || 0}${suffix})`,
  );
}
export function compilePoll(block, ctx) {
  const q = pyQuote(block?.props?.question || '');
  const opts = String(block?.props?.options || '').split('\n').map((l) => pyQuote(l.trim())).filter(Boolean);
  const target = getAnswerTarget(ctx);
  const optsExpr = opts.length ? `[${opts.join(', ')}]` : '[]';
  return compileOutputLine(block, ctx, (suffix) => `await ${target}.answer_poll(${q}, ${optsExpr}${suffix})`);
}
export function compileNotify(block, ctx) {
  const text = dslTextToPythonFString(block?.props?.text || '');
  const chatId = dslRhsToPython(block?.props?.target || 'message.chat.id');
  return compileOutputLine(block, ctx, (suffix) => `await bot.send_message(chat_id=${chatId}, text=${text}${suffix})`);
}
export function compileMenu(block, ctx) {
  const title = dslTextToPythonFString(block?.props?.title || 'Меню');
  const target = getAnswerTarget(ctx);
  return compileOutputLine(block, ctx, (suffix) => `await ${target}.answer(${title}${suffix})`);
}
export function compileRandom(block, ctx) {
  const ind = pyIndent(ctx.indent);
  const target = getAnswerTarget(ctx);
  const variants = String(block?.props?.variants || '')
    .split('\n')
    .map((l) => pyQuote(l.trim()))
    .filter(Boolean)
    .join(', ');
  const { prelude, suffix } = boundKeyboardParts(block, ctx);
  const body = [
    `${ind}import random`,
    `${ind}_variants = [${variants}]`,
    `${ind}await ${target}.answer(random.choice(_variants) if _variants else ""${suffix})`,
  ].join('\n');
  return prelude ? `${prelude}\n${body}` : body;
}
export function compileSwitch(block, ctx) {
  const v = escapePyKey(block?.props?.varname || 'текст');
  const ind = pyIndent(ctx.indent);
  return `${ind}# switch on ${v} — branches compiled as nested if/elif in graph order`;
}
export function compileDatabase(block, ctx) {
  const vn = escapePyKey(block?.props?.varname || 'rows');
  return `${pyIndent(ctx.indent)}${vn} = []  # SQL: ${pyQuote(block?.props?.query || '')}`;
}
export function compileVersion(block, ctx) {
  return `${pyIndent(ctx.indent)}# version ${pyQuote(block?.props?.version || '1.0')}`;
}
export function compileBotDecl(block, ctx) {
  return `${pyIndent(ctx.indent)}# bot token declared at module level`;
}
export function compileGlobalDecl(block, ctx) {
  const n = escapePyKey(block?.props?.varname || 'var');
  const v = dslRhsToPython(block?.props?.value);
  return `${pyIndent(ctx.indent)}${n} = ${v}`;
}
export function compileCommandsDecl(block, ctx) {
  return `${pyIndent(ctx.indent)}# commands registered in set_commands()`;
}
export function compileScenario(block, ctx) {
  return `${pyIndent(ctx.indent)}# scenario ${pyQuote(block?.props?.name || '')}`;
}
export function compileStep(block, ctx) {
  return `${pyIndent(ctx.indent)}# step ${pyQuote(block?.props?.name || '')}`;
}
export function compileMiddleware(block, ctx) {
  return `${pyIndent(ctx.indent)}# middleware ${pyQuote(block?.props?.type || 'before')}`;
}
export function compileCaption(block, ctx) {
  return compileReply(block, ctx);
}
export function compileMedia(block, ctx) {
  return compilePhoto(block, ctx);
}
export function compileSendFile(block, ctx) {
  return compileDocumentSend({ props: { url: block?.props?.file } }, ctx);
}
export function compilePhotoVar(block, ctx) {
  const v = dslRhsToPython(block?.props?.varname || 'photo');
  const captionKw = mediaCaptionKwarg(block);
  const target = getAnswerTarget(ctx);
  return compileOutputLine(block, ctx, (suffix) => `await ${target}.answer_photo(${v}${captionKw}${suffix})`);
}
export function compileDocumentVar(block, ctx) {
  const v = dslRhsToPython(block?.props?.varname || 'document');
  const captionKw = mediaCaptionKwarg(block);
  const target = getAnswerTarget(ctx);
  return compileOutputLine(block, ctx, (suffix) => `await ${target}.answer_document(${v}${captionKw}${suffix})`);
}
export function compilePayment(block, ctx) {
  return `${pyIndent(ctx.indent)}await message.answer_invoice(...)  # payment stub`;
}
export function compileAnalytics(block, ctx) {
  return `${pyIndent(ctx.indent)}logging.info("analytics", extra={"event": ${pyQuote(block?.props?.event || 'event')}})`;
}
export function compileClassify(block, ctx) {
  const vn = escapePyKey(block?.props?.varname || 'intent');
  return `${pyIndent(ctx.indent)}${vn} = None  # classify stub`;
}
export function compileRole(block, ctx) {
  return compileGet({ props: { key: block?.props?.key, varname: block?.props?.varname } }, ctx);
}
export function compileCheckSub(block, ctx) {
  const vn = escapePyKey(block?.props?.varname || 'subscribed');
  return `${pyIndent(ctx.indent)}${vn} = True  # check_sub stub`;
}
export function compileMemberRole(block, ctx) {
  const vn = escapePyKey(block?.props?.varname || 'role');
  return `${pyIndent(ctx.indent)}${vn} = "member"`;
}
export function compileForwardMsg(block, ctx) {
  return `${pyIndent(ctx.indent)}await message.forward(...)  # forward_msg stub`;
}
export function compileBroadcast(block, ctx) {
  const text = dslTextToPythonFString(block?.props?.text || '');
  return `${pyIndent(ctx.indent)}# broadcast: await message.answer(${text})`;
}
export function compileGetUser(block, ctx) {
  return compileGet(block, ctx);
}
export function compileAllKeys(block, ctx) {
  const vn = escapePyKey(block?.props?.varname || 'keys');
  const ind = pyIndent(ctx.indent);
  return [
    `${ind}data = await state.get_data()`,
    `${ind}${vn} = list(data.keys())`,
  ].join('\n');
}
export function compileCallBlock(block, ctx) {
  const name = blockFuncName(block?.props?.blockname || 'block');
  const vn = escapePyKey(block?.props?.varname || 'result');
  return `${pyIndent(ctx.indent)}${vn} = await ${name}(message, state)`;
}

export function transpileBlockToPython(block, context = {}) {
  const type = block?.type || 'message';
  if (context.indent == null) context.indent = 0;
  const ctx = context;
  const fn = compileBlock(block, ctx);
  const compilerName = getCompiler(type)?.name || type;
  if (fn && (!isEventHandlerType(type) || String(fn).includes('await '))) {
    recordTranspileTrace(ctx, block, compilerName, fn);
  }
  return fn;
}

export function compileNodeToPython(node, context = {}) {
  const type = node?.type || 'message';
  const block = { type, props: { ...(node?.payload || {}) } };
  const ctx = { indent: context.indent ?? 0, ...context };
  const lines = [];

  if (isEventHandlerType(type) || type === 'else') {
    lines.push(compileHandlerFromRoot(block, node?.children || [], ctx));
    return lines.join('\n\n');
  }

  const stmt = transpileBlockToPython(block, ctx);
  if (stmt) lines.push(stmt);

  const childIndent =
    isConditionLikeType(type) || type === 'else' || type === 'loop' ? ctx.indent + 1 : ctx.indent;

  for (const child of node?.children || []) {
    lines.push(compileNodeToPython(child, { ...ctx, indent: childIndent }));
  }
  return lines.filter(Boolean).join('\n');
}

function compileStatementBlock(block, ctx) {
  if (isEventHandlerType(block.type) || block.type === 'else') {
    return compileHandlerFromRoot(block, [], { ...ctx, indent: ctx.indent });
  }
  if (isConditionLikeType(block.type) || block.type === 'else' || block.type === 'loop') {
    return compileControlBlock(block, ctx);
  }
  return transpileBlockToPython(block, ctx);
}

function compileStatement(block, ctx) {
  return compileStatementBlock(block, ctx);
}

function compileControlBlock(block, ctx) {
  const lines = [];
  const head = transpileBlockToPython(block, ctx);
  if (head) lines.push(head);
  return lines.join('\n');
}

function distributeEventChainBodies(blocks) {
  const events = [];
  let i = 0;
  while (i < blocks.length && (isEventHandlerType(blocks[i].type) || blocks[i].type === 'else')) {
    events.push(blocks[i]);
    i += 1;
  }
  const trailing = blocks.slice(i);
  if (!events.length) {
    return { events: [], bodies: [], parentTail: trailing };
  }
  const bodies = events.map(() => []);
  if (trailing.length <= 1) {
    if (trailing.length === 1) bodies[bodies.length - 1].push(trailing[0]);
    return { events, bodies, parentTail: [] };
  }
  bodies[bodies.length - 1].push(trailing[0]);
  return { events, bodies, parentTail: trailing.slice(1) };
}

function compileHandlerFromRoot(rootBlock, childNodes, ctx) {
  const innerBlocks = childNodes?.length
    ? childNodes.map((n) => ({ type: n.type, props: { ...(n.payload || {}) }, id: n.id }))
    : [];
  return compileHandlerTree(rootBlock, innerBlocks, ctx);
}

function compileHandlerTree(rootBlock, bodyBlocks, ctx) {
  const indent = ctx.indent ?? 0;
  const lines = [];
  const decorator = compileEventDecorator(rootBlock.type, rootBlock.props, ctx);
  recordTranspileTrace(ctx, rootBlock, `compile${rootBlock.type}Event`, decorator);
  const handlerName = uniqueHandlerName(defaultHandlerName(rootBlock.type, rootBlock.props), ctx);
  
  // Reply keyboard uses block type "callback" + label → @router.message(F.text == …)
  const isCallback = decorator.includes('callback_query');
  const params = isCallback
    ? 'callback: CallbackQuery, state: FSMContext'
    : 'message: Message, state: FSMContext';

  lines.push(`${pyIndent(indent)}${decorator}`);
  lines.push(`${pyIndent(indent)}async def ${handlerName}(${params}):`);

  const bodyIndent = indent + 1;
  const bodyCtx = {
    ...ctx,
    indent: bodyIndent,
    inCallbackHandler: isCallback,
  };

  const { events, bodies, parentTail } = distributeEventChainBodies(bodyBlocks);

  for (let ei = 0; ei < events.length; ei += 1) {
    lines.push(
      compileHandlerTree(events[ei], bodies[ei] || [], {
        ...ctx,
        indent: bodyIndent,
      }),
    );
  }

  const statements = parentTail ?? [];
  if (!statements.length && !events.length) {
    lines.push(`${pyIndent(bodyIndent)}pass`);
    return lines.join('\n');
  }

  for (let si = 0; si < statements.length; si += 1) {
    const block = statements[si];
    if (isConditionLikeType(block.type) || block.type === 'else' || block.type === 'loop') {
      lines.push(compileConditionSequence(statements, si, bodyCtx));
      break;
    }
    const stmt = compileStatement(block, bodyCtx);
    if (stmt) lines.push(stmt);
  }

  // Ensure callback handlers acknowledge the query to stop Telegram loading indicator.
  if (isCallback) {
    const joined = lines.join('\n');
    if (!/callback\.answer\(/.test(joined)) {
      lines.push(`${pyIndent(bodyIndent)}await callback.answer()`);
    }
  }

  return lines.join('\n');
}

function compileConditionSequence(allBlocks, startIndex, ctx) {
  const lines = [];
  let i = startIndex;
  while (i < allBlocks.length) {
    const b = allBlocks[i];
    if (i > startIndex && (isEventHandlerType(b.type) || isRootChunkType(b.type))) break;
    if (isConditionLikeType(b.type) || b.type === 'else' || b.type === 'loop') {
      lines.push(transpileBlockToPython(b, ctx));
      i += 1;
      const branchCtx = { ...ctx, indent: ctx.indent + 1 };
      while (
        i < allBlocks.length &&
        !isConditionLikeType(allBlocks[i].type) &&
        allBlocks[i].type !== 'else' &&
        allBlocks[i].type !== 'loop' &&
        !isEventHandlerType(allBlocks[i].type)
      ) {
        lines.push(compileStatement(allBlocks[i], branchCtx));
        i += 1;
      }
      continue;
    }
    lines.push(compileStatement(b, ctx));
    i += 1;
  }
  return lines.filter(Boolean).join('\n');
}

function compileStackBody(blocks, ctx) {
  if (!blocks.length) return '';
  const root = blocks[0];
  if (root.type === 'block') {
    return compileBlockDefinition(root, blocks.slice(1), ctx);
  }
  if (!isEventHandlerType(root.type) && root.type !== 'else') {
    const lines = [];
    const bodyCtx = { ...ctx };
    for (const b of blocks) {
      if (isConditionLikeType(b.type) || b.type === 'loop') {
        lines.push(compileConditionSequence(blocks, blocks.indexOf(b), bodyCtx));
        break;
      }
      const stmt = compileStatement(b, bodyCtx);
      if (stmt) lines.push(stmt);
    }
    return lines.filter(Boolean).join('\n');
  }
  const rest = blocks.slice(1);
  return compileHandlerTree(root, rest, ctx);
}

function compileBlockDefinition(rootBlock, bodyBlocks, ctx) {
  const name = blockFuncName(rootBlock.props?.name || 'block');
  const lines = [
    `async def ${name}(message: Message, state: FSMContext):`,
  ];
  const bodyCtx = { ...ctx, indent: 1 };
  if (!bodyBlocks.length) {
    lines.push(`${pyIndent(1)}pass`);
  } else {
    const body = compileStackBody(bodyBlocks, bodyCtx);
    lines.push(body);
  }
  return lines.join('\n');
}

// --- module assembly ---

function parseCommandLines(commandsText) {
  const out = [];
  for (const line of String(commandsText || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(/^"?([^"]+)"?\s*-\s*"?([^"]*)"?$/);
    if (m) {
      out.push({ command: m[1].replace(/^\//, ''), description: m[2] });
      continue;
    }
    if (t.includes(' - ') && t.startsWith('"')) {
      const [cmd, desc] = t.split(' - ').map((s) => s.replace(/^"|"$/g, '').trim());
      out.push({ command: cmd.replace(/^\//, ''), description: desc });
    }
  }
  return out;
}

function collectModuleMeta(stacks) {
  const meta = {
    version: '1.0',
    botToken: 'YOUR_BOT_TOKEN',
    globals: [],
    commands: [],
    fsmStates: new Map(),
    blockFuncs: [],
    needsAiohttp: false,
    needsDb: false,
  };

  for (const stack of stacks || []) {
    const blocks = stack?.blocks || [];
    if (!blocks.length) continue;
    const root = blocks[0];
    if (root.type === 'version') meta.version = root.props?.version || meta.version;
    if (root.type === 'bot') meta.botToken = String(root.props?.token || meta.botToken).trim() || meta.botToken;
    if (root.type === 'global' || root.type === 'set_global') {
      meta.globals.push({
        name: root.props?.varname || 'var',
        value: dslRhsToPython(root.props?.value),
      });
    }
    if (root.type === 'commands') {
      meta.commands.push(...parseCommandLines(root.props?.commands));
    }
    if (root.type === 'block') {
      meta.blockFuncs.push(compileBlockDefinition(root, blocks.slice(1), { indent: 0 }));
    }
    for (const b of blocks) {
      if (b.type === 'ask') {
        const field = toPyIdent(b.props?.varname || 'field');
        if (!meta.fsmStates.has('Form')) meta.fsmStates.set('Form', new Set());
        meta.fsmStates.get('Form').add(field);
      }
      if (b.type === 'http') meta.needsAiohttp = true;
      if (b.type === 'inline_db') meta.needsDb = true;
      if (b.type === 'scenario') {
        const sc = toPascalCase(b.props?.name || 'Scenario');
        if (!meta.fsmStates.has(sc)) meta.fsmStates.set(sc, new Set());
      }
      if (b.type === 'step') {
        const sc = toPascalCase(b.props?.scenario || 'Scenario');
        if (!meta.fsmStates.has(sc)) meta.fsmStates.set(sc, new Set());
        meta.fsmStates.get(sc).add(toPyIdent(b.props?.name || 'step'));
      }
      // FIX: Track goto targets to automatically create FSM states
      if (b.type === 'goto' || b.type === 'run') {
        const target = b?.props?.target ?? b?.props?.label ?? b?.props?.name ?? b?.props?.scenario ?? 'main';
        const parts = String(target).split(/[./]/).filter(Boolean);
        const scenario = parts[0] || 'Scenario';
        const step = parts[1] || parts[0] || 'step';
        const sc = toPascalCase(scenario);
        if (!meta.fsmStates.has(sc)) meta.fsmStates.set(sc, new Set());
        if (parts.length > 1) {
          meta.fsmStates.get(sc).add(toPyIdent(step));
        } else {
          // Single-part target like 'main' becomes a state in Scenario
          const defaultScenario = toPascalCase('Scenario');
          if (!meta.fsmStates.has(defaultScenario)) meta.fsmStates.set(defaultScenario, new Set());
          meta.fsmStates.get(defaultScenario).add(toPyIdent(target));
        }
      }
    }
  }
  return meta;
}

function emitFsmStates(fsmStates) {
  const lines = [];
  for (const [group, fields] of fsmStates.entries()) {
    // Skip emitting empty State groups — avoid dead / unused FSM classes
    if (!fields || fields.size === 0) continue;
    lines.push(`class ${group}(StatesGroup):`);
    for (const f of fields) {
      lines.push(`    ${f} = State()`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function emitSetCommands(commands) {
  if (!commands.length) return '';
  const items = commands
    .map(
      (c) =>
        `        BotCommand(command=${pyQuote(String(c.command || '').replace(/^\//, '').trim())}, description=${pyQuote(String(c.description || ''))})`,
    )
    .join(',\n');
  return [
    'async def set_commands(bot: Bot):',
    '    await bot.set_my_commands([',
    items,
    '    ])',
    '',
  ].join('\n');
}

/**
 * Bootstrap-only bot.py when canvas has bot/version/commands but no handlers yet.
 * @param {unknown[]} stacks
 */
export function buildMetadataBootstrapModule(stacks) {
  const meta = collectModuleMeta(stacks || []);
  const parts = [
    '"""Generated by Cicada Studio — aiogram 3."""',
    'import asyncio',
    'import logging',
    '',
    'from aiogram import Bot, Dispatcher, Router',
    '',
    `# version ${meta.version}`,
    'logging.basicConfig(level=logging.INFO)',
    'logger = logging.getLogger("cicada.bot")',
    '',
    `bot = Bot(token=${pyQuote(meta.botToken)})`,
    'dp = Dispatcher()',
    'router = Router()',
    '',
    '# Добавьте Command, Text, Callback или Start — /start не обязателен.',
    '',
  ];
  const setCmd = emitSetCommands(meta.commands);
  if (setCmd) parts.push(setCmd);
  parts.push(
    'async def main():',
    '    dp.include_router(router)',
    '    await dp.start_polling(bot)',
    '',
    "if __name__ == '__main__':",
    '    asyncio.run(main())',
    '',
  );
  return parts.join('\n');
}

export function buildPythonModule(stacks, options = {}) {
  const bind = bindStacksForCodegen(stacks || []);
  if (!bind.ok) {
    const first = bind.errors[0];
    throw new CodegenError(first.message, {
      code: first.code || 'KeyboardWithoutOutputNode',
      nodeId: first.nodeId,
      blockType: first.blockType,
    });
  }
  stacks = bind.stacks;

  assertCallbackResolution(stacks, options.flow || null);

  const transpileTrace = options.transpileTrace || [];
  const compileWarnings = options.compileWarnings;
  const inlineCallbackData = new Set(
    collectRequiredCallbackData(stacks).map((r) => r.callbackData),
  );
  const ctx = { transpileTrace, storage: options.storage, inlineCallbackData };
  // Preprocess stacks: build execution graph, merge handlers, dedupe and remove dead flows
  const exec = buildExecutionGraph(stacks).stacks;
  stacks = mergeHandlerStacks(exec, ctx);
  stacks = dedupeHandlers(stacks);
  stacks = removeDeadFlows(stacks);
  const HANDLER_EMIT_ORDER = {
    start: 0,
    command: 1,
    callback: 2,
    on_photo: 10,
    on_document: 11,
    on_voice: 12,
    on_sticker: 13,
    on_location: 14,
    on_contact: 15,
    on_text: 40,
  };
  stacks = [...stacks].sort((a, b) => {
    const ta = a?.blocks?.[0]?.type;
    const tb = b?.blocks?.[0]?.type;
    const pa = HANDLER_EMIT_ORDER[ta] ?? (isEventHandlerType(ta) ? 20 : 100);
    const pb = HANDLER_EMIT_ORDER[tb] ?? (isEventHandlerType(tb) ? 20 : 100);
    return pa - pb;
  });
  const meta = collectModuleMeta(stacks);
  const handlerBodies = [];

  const imports = [
    '"""Generated by Cicada Studio — aiogram 3."""',
    'import asyncio',
    'import logging',
    '',
    'from aiogram import Bot, Dispatcher, F, Router',
    'from aiogram.filters import Command, CommandStart, StateFilter',
    'from aiogram.fsm.context import FSMContext',
    'from aiogram.types import (',
    '    BotCommand,',
    '    CallbackQuery,',
    '    InlineKeyboardButton,',
    '    InlineKeyboardMarkup,',
    '    KeyboardButton,',
    '    Message,',
    '    ReplyKeyboardMarkup,',
    ')',
  ];
  if (meta.needsAiohttp) imports.splice(4, 0, 'import aiohttp');
  if (meta.needsDb) imports.push('', '# project DB adapter', 'db = {}  # replace with real db.get()');

  const parts = [
    imports.join('\n'),
    '',
    `GLOBAL_STORE: dict = {}`,
    '',
  ];

  for (const g of meta.globals) {
    parts.push(`${escapePyKey(g.name)} = ${g.value}`);
  }
  if (meta.globals.length) parts.push('');

  const fsmCode = emitFsmStates(meta.fsmStates);
  if (fsmCode.trim()) {
    // ensure State/StatesGroup import present when FSM states are emitted
    const stateImport = 'from aiogram.fsm.state import State, StatesGroup';
    if (!imports.includes(stateImport)) {
      const idx = imports.indexOf('from aiogram.fsm.context import FSMContext');
      if (idx >= 0) imports.splice(idx + 1, 0, stateImport);
      else imports.splice(4, 0, stateImport);
    }
    // refresh assembled imports header
    parts[0] = imports.join('\n');
    parts.push(fsmCode);
  }

  parts.push('logging.basicConfig(');
  parts.push('    level=logging.INFO,');
  parts.push('    format="%(asctime)s [%(levelname)s] %(message)s",');
  parts.push(')');
  parts.push('logger = logging.getLogger("cicada.bot")');
  parts.push('');
  parts.push(`bot = Bot(token=${pyQuote(meta.botToken)})`);
  parts.push('dp = Dispatcher()');
  parts.push('router = Router()');
  parts.push('');

  const setCmd = emitSetCommands(meta.commands);
  if (setCmd) parts.push(setCmd);

  for (const fn of meta.blockFuncs) {
    parts.push(fn);
    parts.push('');
  }

  const handlerNames = new Set();
  for (const stack of stacks || []) {
    const blocks = stack?.blocks || [];
    if (!blocks.length) continue;
    const root = blocks[0];
    if (isEventHandlerType(root.type) || root.type === 'else') {
      const h = compileStackBody(blocks, {
        ...ctx,
        indent: 0,
        handlerNames,
        fsmStates: meta.fsmStates,
        transpileTrace,
      });
      if (h?.trim()) {
        handlerBodies.push(h);
        parts.push(h);
        parts.push('');
      }
    }
  }

  if (!handlerBodies.length) {
    return '';
  }

  parts.push('async def main():');
  parts.push('    logger.info("Cicada Studio: starting aiogram polling")');
  parts.push('    dp.include_router(router)');
  if (meta.commands.length) parts.push('    await set_commands(bot)');
  parts.push('    await dp.start_polling(bot)');
  parts.push('');
  parts.push("if __name__ == '__main__':");
  parts.push('    asyncio.run(main())');
  parts.push('');

  const moduleSrc = parts.join('\n');
  // run a light validation / normalization pass over generated Python
  return validateAiogram3Code(moduleSrc);
}

/** Block type from React Flow node (unwraps GraphDocument `cicada` wrapper). */
function flowBlockType(node) {
  return normalizeFlowNode(node).type;
}

/** UI attachments live in GraphDocument node.meta, projected as data.meta on canvas nodes. */
function flowNodeUiAttachments(node) {
  const data = node?.data;
  if (!data || typeof data !== 'object') return undefined;
  const fromMeta = data.meta?.uiAttachments;
  if (fromMeta && typeof fromMeta === 'object') return fromMeta;
  if (data.uiAttachments && typeof data.uiAttachments === 'object') return data.uiAttachments;
  return undefined;
}

export function flowToStacks(flow) {
  // Edge-first deterministic traversal: convert graph into explicit execution paths.
  // Nodes and edges are expected arrays in flow.
  const nodes = flow?.nodes || [];
  const edges = flow?.edges || [];
  const nodeById = new Map(nodes.map((n) => [String(n.id), n]));

  // Build deterministic adjacency map: sort by edge.order if present, otherwise by edge.id
  const adj = new Map();
  for (const e of edges || []) {
    const src = String(e.source);
    if (!adj.has(src)) adj.set(src, []);
    adj.get(src).push(e);
  }
  for (const [k, list] of adj.entries()) {
    list.sort((a, b) => {
      const ao = a.order ?? null;
      const bo = b.order ?? null;
      if (ao != null && bo != null) return Number(ao) - Number(bo);
      if (ao != null) return -1;
      if (bo != null) return 1;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
  }

  // Roots: event handler nodes (start/command/callback/on_text/else etc.)
  const roots = (nodes || []).filter(
    (n) => isEventHandlerType(flowBlockType(n)) || flowBlockType(n) === 'else',
  );

  // Diagnostics collector (cycles, orphan nodes, ambiguous routes)
  if (typeof exportCompileDiagnostics === 'undefined') {
    // Ensure exported diagnostics container exists
    // eslint-disable-next-line no-undef
    globalThis.exportCompileDiagnostics = [];
  }
  globalThis.exportCompileDiagnostics.length = 0;

  // Collect all execution paths by DFS from each root, preserving branching.
  const stacks = [];
  function collectPaths(rootNode) {
    const rootId = String(rootNode.id);
    const paths = [];
    const stack = [];

    // initial execution context at root
    const rootType = flowBlockType(rootNode);
    const initCtx = {
      rootNodeId: rootId,
      routeType: rootType,
      handlerType: rootType,
      asyncContext: isEventHandlerType(rootType),
      callbackContext: rootType === 'callback',
      fsmContext: { enabled: false },
      parentHandlerId: rootId,
      executionPath: [],
    };

    function dfs(currId, visited, ctx) {
      if (visited.has(currId)) {
          globalThis.exportCompileDiagnostics.push({ kind: 'cycle_detected', node: currId, path: [...visited] });
        return;
      }
      visited.add(currId);
      stack.push(currId);

      // clone context for this path
      const node = nodeById.get(String(currId));
      const t = flowBlockType(node);
      const newCtx = { ...ctx, executionPath: [...(ctx.executionPath || []), String(currId)] };

      // propagate special scopes
      if (t === 'callback') {
        newCtx.callbackContext = true;
        newCtx.asyncContext = true; // callbacks run in async handler context
      }
      // FSM-related role set
      if (typeof ROLE_FSM !== 'undefined' && ROLE_FSM && ROLE_FSM.has(t)) {
        newCtx.fsmContext = { enabled: true };
      } else {
        // fallback: if type name matches common FSM types
        if (t === 'ask' || t === 'remember' || t === 'goto' || t === 'stop' || t === 'get' || t === 'save') {
          newCtx.fsmContext = { enabled: true };
        }
      }

      const outs = adj.get(currId) || [];
      if (!outs.length) {
        // terminal path — record execution context along the path
        paths.push({ path: [...stack], ctx: newCtx });
      } else {
        for (const e of outs) {
          const tgt = String(e.target);
          dfs(tgt, new Set(visited), newCtx);
        }
      }
      stack.pop();
    }

    dfs(rootId, new Set(), initCtx);
    return paths;
  }

  for (const r of roots) {
    const paths = collectPaths(r);
    if (!paths.length) {
      // root without outgoing edges -> single-block stack
      const blk = normalizeFlowNode(r);
      const rootType = flowBlockType(r);
      const meta = {
        executionContext: {
          rootNodeId: String(r.id),
          routeType: rootType,
          handlerType: rootType,
          asyncContext: isEventHandlerType(rootType),
          callbackContext: rootType === 'callback',
          fsmContext: { enabled: false },
          parentHandlerId: String(r.id),
          executionPath: [String(r.id)],
        },
      };
      stacks.push({ id: `stack_${r.id}`, x: r.position?.x ?? 120, y: r.position?.y ?? 120, blocks: [{ id: r.id, type: blk.type, props: { ...(blk.props || {}) }, uiAttachments: flowNodeUiAttachments(r) }], meta });
      continue;
    }
    let idx = 0;
    for (const pinfo of paths) {
      const p = pinfo.path;
      const ctx = pinfo.ctx || {};
      const blocks = p.map((nid) => {
        const n = nodeById.get(String(nid));
        const b = normalizeFlowNode(n || {});
        return { id: String(nid), type: b.type, props: { ...(b.props || {}) }, uiAttachments: flowNodeUiAttachments(n) };
      });
      const meta = { executionContext: ctx };
      stacks.push({ id: `stack_${r.id}_${idx++}`, x: r.position?.x ?? 120, y: r.position?.y ?? 120, blocks, meta });
    }
  }

  // Orphan nodes: nodes not reachable from any root
  const reachable = new Set(stacks.flatMap((s) => s.blocks.map((b) => String(b.id))));
  for (const n of nodes) {
    if (!reachable.has(String(n.id))) {
      globalThis.exportCompileDiagnostics.push({ kind: 'orphan_node', node: String(n.id) });
      // Emit as standalone stack so codegen can surface it
      const b = normalizeFlowNode(n);
      const orphanType = flowBlockType(n);
      const meta = {
        executionContext: {
          rootNodeId: String(n.id),
          routeType: orphanType,
          handlerType: orphanType,
          asyncContext: isEventHandlerType(orphanType),
          callbackContext: orphanType === 'callback',
          fsmContext: { enabled: false },
          parentHandlerId: String(n.id),
          executionPath: [String(n.id)],
        },
      };
      stacks.push({ id: `stack_orphan_${n.id}`, x: n.position?.x ?? 120, y: n.position?.y ?? 120, blocks: [{ id: n.id, type: b.type, props: { ...(b.props || {}) }, uiAttachments: flowNodeUiAttachments(n) }], meta });
    }
  }

  return stacks;
}

// --- preprocessing / compilation helpers ---

export function buildExecutionGraph(stacks = []) {
  // Execution graph layer: currently identity wrapper over stacks produced by edge-first traversal.
  // In future this can build richer graph metadata (adjacency, node->stack mapping, metrics).
  return { stacks: (stacks || []).map((s) => ({ ...s })) };
}

export function mergeHandlerStacks(stacks = [], ctx = {}) {
  // NO-OP merge: merging by decorator string caused nondeterministic handler merges.
  // Merge only when explicit semantic equivalence is proven (not implemented here).
  return (stacks || []).map((s) => ({ ...s }));
}

export function dedupeHandlers(stacks = []) {
  const seen = new Set();
  const out = [];
  for (const s of stacks || []) {
    const key = JSON.stringify((s.blocks || []).map((b) => ({ type: b.type, props: b.props })));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function removeDeadFlows(stacks = []) {
  return (stacks || []).filter((s) => {
    const blocks = s?.blocks || [];
    if (!blocks.length) return false;
    // If it's an event-root with no meaningful body, drop it
    const root = blocks[0];
    if ((isEventHandlerType(root.type) || root.type === 'else') && blocks.length <= 1) return false;
    return true;
  });
}

export function validateAiogram3Code(code = '') {
  let out = String(code || '');
  // Fix lower-case true/false to Python booleans in assignments
  out = out.replace(/=\s*\btrue\b/gi, '= True');
  out = out.replace(/=\s*\bfalse\b/gi, '= False');
  // Trim trailing spaces in command strings inside BotCommand(...) tuples
  out = out.replace(/BotCommand\(command=(?:f)?("|')([^"']*)("|')/g, (m, q, cmd) => `BotCommand(command=${q}${cmd.trim()}${q}`);
  // Normalize any remaining accidental lowercase true/false in code
  out = out.replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False');
  return out;
}

export function stackToPython(stack, options = {}) {
  const bind = bindStacksForCodegen([{ blocks: stack?.blocks || [], id: stack?.id }]);
  if (!bind.ok) {
    const first = bind.errors[0];
    throw new CodegenError(first.message, {
      code: first.code || 'KeyboardWithoutOutputNode',
      nodeId: first.nodeId,
    });
  }
  const blocks = bind.stacks[0]?.blocks || [];
  if (!blocks.length) return '';
  const ctx = { indent: 0, handlerNames: new Set(), fsmStates: new Map(), ...options };
  return compileStackBody(blocks, ctx);
}

export function generatePythonFromStacks(stacks, options = {}) {
  if (isStacksEmptyForCodegen(stacks)) return '';
  const nonEmpty = (stacks || []).filter((s) => (s?.blocks || []).length);
  if (!nonEmpty.length) return '';
  return buildPythonModule(stacks, options);
}

export function extractPythonHandlers(fullModule) {
  const src = String(fullModule || '');
  const marker = '@router.';
  const idx = src.indexOf(marker);
  if (idx < 0) return src.trim();
  return src.slice(idx).trim() + '\n';
}

export const PYTHON_EXPORT_MODES = Object.freeze({
  FULL_MODULE: 'full_module',
  HANDLERS_ONLY: 'handlers_only',
});

export function blockToCodegenNode(block, children = []) {
  return {
    type: block?.type || 'message',
    payload: { ...(block?.props || {}) },
    children,
  };
}
