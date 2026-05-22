/**
 * Fix ModuleLibrary.jsx templates: кнопки only after ответ.
 * Run: node scripts/fix-module-library-buttons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '../src/ModuleLibrary.jsx');

const KNOPKI_RE = /^\s+кнопки(\s|:)/;
const OTET_RE = /^\s+ответ/;
const COMMENT_RE = /^\s*#/;
// \\b не работает после кириллицы в JS — только (?:\\s|$)
const ORPHAN_AFTER_RE = /^\s+(использовать|перейти|прервать|продолжить|завершить сценарий|стоп)(?:\s|$)/;
const REPLY_STMT_RE = /^\s+(ответ|рандом|фото|видео|аудио|документ|опрос|стикер|контакт|локация|inline|кнопки:)/;

function lineIndent(line) {
  const m = String(line).match(/^(\s*)/);
  return m ? m[1].length : 0;
}

function hasRecentReply(out, knopkiIndent) {
  for (let p = out.length - 1; p >= 0; p -= 1) {
    const l = out[p];
    if (isEmpty(l)) continue;
    if (lineIndent(l) < knopkiIndent) return true;
    if (REPLY_STMT_RE.test(l)) return true;
    if (KNOPKI_RE.test(l)) return true;
    if (ORPHAN_AFTER_RE.test(l)) return false;
    if (LOGIC_START_RE.test(l)) return false;
  }
  return false;
}
const START_HEADER_RE = /^(старт|при старте):$/;
const LOGIC_START_RE = /^\s+(если|иначе|получить|запомни|сохранить|использовать|перейти|глобально|проверить|лог|уведомить|рассылка|http_|fetch|классифицировать|спросить|удалить|все_ключи|для|пока|повторять|таймаут|стоп|вернуть|продолжить|прервать)(?:\s|:|$)/i;

function isEmpty(line) {
  return !String(line).trim();
}

function fixDslCode(code) {
  const lines = code.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (START_HEADER_RE.test(line.trim())) {
      out.push(line);
      i += 1;
      let j = i;
      while (j < lines.length && (isEmpty(lines[j]) || COMMENT_RE.test(lines[j]))) {
        out.push(lines[j]);
        j += 1;
      }
      if (j < lines.length && KNOPKI_RE.test(lines[j])) {
        let k = j + 1;
        while (k < lines.length && KNOPKI_RE.test(lines[k])) k += 1;
        while (k < lines.length && isEmpty(lines[k])) k += 1;
        const nextMeaningful = k < lines.length ? lines[k] : '';
        if (LOGIC_START_RE.test(nextMeaningful)) {
          i = k;
          continue;
        }
        const indent = lines[j].match(/^(\s+)/)?.[1] || '    ';
        if (!OTET_RE.test(lines[j - 1] || '')) {
          out.push(`${indent}ответ "👋 Добро пожаловать!"`);
        }
        while (j < k) {
          out.push(lines[j]);
          j += 1;
        }
        i = j;
        continue;
      }
      continue;
    }

    if (KNOPKI_RE.test(line)) {
      let prev = out.length - 1;
      while (prev >= 0 && isEmpty(out[prev])) prev -= 1;
      const knopkiIndent = lineIndent(line);
      if (prev >= 0 && ORPHAN_AFTER_RE.test(out[prev])) {
        i += 1;
        while (i < lines.length && KNOPKI_RE.test(lines[i])) i += 1;
        continue;
      }
      if (!hasRecentReply(out, knopkiIndent)) {
        i += 1;
        while (i < lines.length && (KNOPKI_RE.test(lines[i]) || (isEmpty(lines[i]) && i + 1 < lines.length && KNOPKI_RE.test(lines[i + 1])))) {
          if (KNOPKI_RE.test(lines[i])) i += 1;
          else i += 1;
        }
        continue;
      }
      if (i + 1 < lines.length && OTET_RE.test(lines[i + 1])) {
        out.push(lines[i + 1]);
        out.push(line);
        i += 2;
        while (i < lines.length && KNOPKI_RE.test(lines[i]) && !OTET_RE.test(lines[i])) {
          out.push(lines[i]);
          i += 1;
        }
        continue;
      }
    }

    out.push(line);
    i += 1;
  }

  return out.join('\n');
}

const src = fs.readFileSync(FILE, 'utf8');
const CODE_BLOCK_RE = /(code:\s*`)([\s\S]*?)(`)/g;

let count = 0;
const next = src.replace(CODE_BLOCK_RE, (full, open, body, close) => {
  const fixed = fixDslCode(body);
  if (fixed !== body) count += 1;
  return open + fixed + close;
});

if (count === 0) {
  console.log('No template blocks changed.');
} else {
  fs.writeFileSync(FILE, next);
  console.log(`Updated ${count} code templates in ModuleLibrary.jsx`);
}
