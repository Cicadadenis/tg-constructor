import fs from 'fs';
import path from 'path';

/** True when text is UTF-8 Cyrillic shown as CP1252 (Р—Р°…, рџ…, вњЁ). */
export function isMojibake(str) {
  if (!str || str.length < 2) return false;
  if (/Р[—ќЊ-Яа-яЁё]/.test(str)) return true;
  if (/Р['ќњў]/.test(str)) return true;
  if (/рџ/.test(str)) return true;
  if (/в(њЁ|†|—|љ|¦|љЎ|љ )/.test(str)) return true;
  if (/вљ/.test(str)) return true;
  // Already-valid UTF-8 must not be re-decoded.
  if (/^[\u0400-\u04FF\s.,!?;:()\-—«»""''\d]+$/u.test(str) && !/Р/.test(str)) return false;
  return /[\u0080-\u00FF]{2,}/.test(str) && /Р|рџ|вњ|в†|вљ|в„/.test(str);
}

export function unmojibake(str) {
  const bytes = Uint8Array.from(str, (ch) => ch.charCodeAt(0) & 0xff);
  return Buffer.from(bytes).toString('utf8');
}

/** Fix mojibake runs inside a larger string without touching valid Cyrillic. */
export function fixMojibakeRuns(text) {
  const re =
    /(?:Р[—\u0400-\u04FF\u2013\u2014][\u0400-\u04FF\u2013\u2014«»""'',\s]*)+|(?:рџ[\u0400-\u04FF]+)|(?:в(?:њЁ|†'|—€|љЎ|љ |¦|љ))|(?:вљ[\u0400-\u04FF]+)|(?:в„№[\u0400-\u04FF]+)/g;
  return text.replace(re, (chunk) => {
    if (!isMojibake(chunk)) return chunk;
    const out = unmojibake(chunk);
    return out.includes('\uFFFD') ? chunk : out;
  });
}

function repairFile(filePath) {
  let text = fs.readFileSync(filePath, 'utf8');
  const before = text;

  // Undo broken literal "\n" sequences introduced by a bad prior fix.
  text = text.replace(/\\n([ \t]+)/g, '\n$1');

  text = fixMojibakeRuns(text);

  if (text !== before) {
    fs.writeFileSync(filePath, text, 'utf8');
    console.log('fixed:', filePath);
  }
}

for (const t of process.argv.slice(2)) repairFile(path.resolve(t));
