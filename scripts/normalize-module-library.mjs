#!/usr/bin/env node
/**
 * Normalizes MODULES example DSL in src/ModuleLibrary.jsx:
 * - bot "YOUR_BOT_TOKEN" first (after версия)
 * - старт / при старте with кнопки for every при нажатии "…" handler
 * - each handler without кнопки gets navigation кнопки
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TARGET = path.join(ROOT, 'src/ModuleLibrary.jsx');
const BOT_LINE = 'бот "YOUR_BOT_TOKEN"';

function collectHandlerLabels(code) {
  const labels = [];
  for (const m of code.matchAll(/^\s*при нажатии\s+"([^"]+)"/gm)) {
    if (m[1]) labels.push(m[1]);
  }
  return [...new Set(labels)];
}

function findEntryBlockStart(lines) {
  return lines.findIndex((l) => /^\s*(старт|при старте)\s*:/.test(l));
}

function collectEntryButtonLabels(lines, startIdx) {
  const labels = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^(при |команда |блок |глобально|бот |версия|команды:|иначе\b|сценарий\b|до каждого\b)/.test(t)) break;
    if (t.startsWith('кнопки')) {
      for (const q of lines[i].matchAll(/"([^"]+)"/g)) labels.push(q[1]);
    }
  }
  return labels;
}

function formatButtonsLine(labels, indent = '    ') {
  if (!labels.length) return '';
  const quoted = labels.map((l) => `"${l.replace(/"/g, '\\"')}"`).join(' ');
  return `${indent}кнопки ${quoted}`;
}

function blockHasButtons(blockLines) {
  let afterButtons = false;
  for (const bl of blockLines) {
    const t = bl.trim();
    if (!t) continue;
    // Note: \b does not treat Cyrillic as word chars in JS — use /^кнопки/
    if (/^кнопки/.test(t)) {
      afterButtons = true;
      return true;
    }
    if (afterButtons && (t.startsWith('[') || t.startsWith('"'))) return true;
    afterButtons = false;
  }
  return false;
}

function ensureBotLine(code) {
  let c = code
    .replace(/бот\s+"0000000000:PASTE_YOUR_BOTFATHER_TOKEN_HERE"/g, BOT_LINE)
    .replace(/бот\s+""/g, BOT_LINE);

  const lines = c.split('\n');
  const withoutBot = lines.filter((l) => !/^\s*бот\s+"/.test(l));

  let insertAt = 0;
  if (/^\s*версия\s+/.test(withoutBot[0] || '')) insertAt = 1;

  withoutBot.splice(insertAt, 0, BOT_LINE, '');
  return withoutBot.join('\n').replace(/\n{3,}/g, '\n\n');
}

function ensureEntryBlock(code, handlerLabels) {
  if (!handlerLabels.length) return code;
  const lines = code.split('\n');
  const startIdx = findEntryBlockStart(lines);
  const botIdx = lines.findIndex((l) => l.trim() === BOT_LINE);

  if (startIdx < 0) {
    const insertAt = botIdx >= 0 ? botIdx + 1 : 0;
    const block = ['старт:', formatButtonsLine(handlerLabels), ''];
    lines.splice(insertAt, 0, ...block);
    return lines.join('\n');
  }

  const startIndent = (lines[startIdx].match(/^(\s*)/) || ['', ''])[1].length;
  const childIndent = startIndent + 4;
  const childPrefix = ' '.repeat(childIndent);

  let firstTopButtonsIdx = -1;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    const lead = (lines[i].match(/^(\s*)/) || ['', ''])[1].length;
    if (lead <= startIndent) break;
    if (lead === childIndent && /^кнопки/.test(trimmed) && firstTopButtonsIdx < 0) {
      firstTopButtonsIdx = i;
      break;
    }
  }

  const merged = [...new Set([...collectEntryButtonLabels(lines, startIdx), ...handlerLabels])];
  const buttonsLine = formatButtonsLine(merged, childPrefix);
  if (firstTopButtonsIdx >= 0) {
    lines[firstTopButtonsIdx] = buttonsLine;
  } else {
    lines.splice(startIdx + 1, 0, buttonsLine);
  }
  return lines.join('\n');
}

function ensureHandlerButtons(code, handlerLabels) {
  if (!handlerLabels.length) return code;

  const lines = code.split('\n');
  const out = [];
  const navLine = formatButtonsLine(handlerLabels);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^(\s*)при нажатии\s+"([^"]+)":\s*$/);
    if (!m) {
      out.push(line);
      i++;
      continue;
    }

    out.push(line);
    const indent = m[1];
    const blockLines = [];
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j];
      if (/^\s*при нажатии\s+"[^"]+":\s*$/.test(next)) break;
      if (/^\s*(команда|блок|старт|глобально|версия|бот|команды:|иначе\b|при старте\b|сценарий\b|до каждого\b)/.test(next)) break;
      blockLines.push(next);
      j++;
    }

    for (const bl of blockLines) out.push(bl);
    if (!blockHasButtons(blockLines) && navLine) {
      out.push(navLine.replace(/^    /, `${indent}    `));
    }
    i = j;
  }

  return out.join('\n');
}

function normalizeExampleCode(code) {
  let c = ensureBotLine(code);
  const handlerLabels = collectHandlerLabels(c);
  c = ensureEntryBlock(c, handlerLabels);
  c = ensureHandlerButtons(c, handlerLabels);
  return c.replace(/\n{3,}/g, '\n\n').trimEnd();
}

function main() {
  const src = fs.readFileSync(TARGET, 'utf8');
  let count = 0;
  const next = src.replace(/code: `([\s\S]*?)`/g, (full, body) => {
    count++;
    return `code: \`${normalizeExampleCode(body)}\``;
  });
  fs.writeFileSync(TARGET, next);
  console.log(`Normalized ${count} module examples in ${TARGET}`);
}

main();
