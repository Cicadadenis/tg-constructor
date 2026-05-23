/**
 * Lightweight Python syntax tokens for preview pane (no external highlighter).
 */

const KEYWORDS = new Set([
  'async', 'await', 'def', 'if', 'else', 'elif', 'for', 'while', 'return', 'import', 'from',
  'as', 'with', 'None', 'True', 'False', 'and', 'or', 'not', 'in', 'pass', 'break', 'continue',
]);

const COLORS = {
  keyword: '#c792ea',
  decorator: '#ffcb6b',
  string: '#c3e88d',
  number: '#f78c6c',
  builtin: '#82aaff',
  comment: '#546e7a',
  plain: 'var(--text2)',
};

function tokenizePythonLine(line) {
  const tokens = [];
  let i = 0;
  while (i < line.length) {
    const rest = line.slice(i);
    if (/^\s+/.test(rest)) {
      const m = rest.match(/^\s+/);
      tokens.push({ t: 'ws', v: m[0] });
      i += m[0].length;
      continue;
    }
    if (rest.startsWith('#')) {
      tokens.push({ t: 'comment', v: rest });
      break;
    }
    if (rest.startsWith('@')) {
      const m = rest.match(/^@\w+(?:\.\w+)*/);
      tokens.push({ t: 'decorator', v: m[0] });
      i += m[0].length;
      continue;
    }
    if (rest.startsWith('f"') || rest.startsWith("f'") || rest.startsWith('"') || rest.startsWith("'")) {
      const q = rest[1] === '"' || rest[1] === "'" ? rest[1] : rest[0];
      const prefix = rest[0] === 'f' ? 'f' : '';
      let j = prefix.length + 1;
      let escaped = false;
      while (j < rest.length) {
        const ch = rest[j];
        if (escaped) { escaped = false; j += 1; continue; }
        if (ch === '\\') { escaped = true; j += 1; continue; }
        if (ch === q) { j += 1; break; }
        j += 1;
      }
      tokens.push({ t: 'string', v: rest.slice(0, j) });
      i += j;
      continue;
    }
    const word = rest.match(/^[A-Za-z_][\w]*/);
    if (word) {
      const w = word[0];
      if (KEYWORDS.has(w)) tokens.push({ t: 'keyword', v: w });
      else if (['Message', 'FSMContext', 'CallbackQuery', 'Router', 'F'].includes(w)) {
        tokens.push({ t: 'builtin', v: w });
      } else tokens.push({ t: 'plain', v: w });
      i += w.length;
      continue;
    }
    if (/^\d+/.test(rest)) {
      const m = rest.match(/^\d+(?:\.\d+)?/);
      tokens.push({ t: 'number', v: m[0] });
      i += m[0].length;
      continue;
    }
    tokens.push({ t: 'plain', v: rest[0] });
    i += 1;
  }
  return tokens;
}

export function highlightPythonLine(line) {
  return tokenizePythonLine(line).map((tok, idx) => ({
    key: idx,
    color: COLORS[tok.t] || COLORS.plain,
    text: tok.v,
  }));
}
