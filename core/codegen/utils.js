export function pyIndent(level) {
  return '    '.repeat(Math.max(0, level));
}

export function pyQuote(s) {
  const raw = String(s ?? '');
  if (raw.includes('"') && !raw.includes("'")) return `'${raw}'`;
  return `"${raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

export function escapePyKey(key) {
  const k = String(key ?? '').trim();
  if (/^[A-Za-z_\u0400-\u04FF][\w\u0400-\u04FF]*$/.test(k)) return k;
  return pyQuote(k);
}

export function toPyIdent(name) {
  return (
    String(name || 'unnamed')
      .trim()
      .replace(/[^\w\u0400-\u04FF]+/gu, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase() || 'unnamed'
  );
}

export function toPascalCase(name) {
  return (
    toPyIdent(name)
      .split('_')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('') || 'Scenario'
  );
}

export function blockFuncName(name) {
  return `block_${toPyIdent(name)}`;
}

export function scenarioStateRef(scenario, step) {
  const cls = toPascalCase(scenario || 'Scenario');
  const st = toPyIdent(step || 'step');
  return `${cls}.${st}`;
}
