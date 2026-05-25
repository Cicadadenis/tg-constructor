import React from 'react';

const TELEGRAM_HTML_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'code', 'pre', 'a']);
const HTML_ENTITY_MAP = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeHtmlEntities(s) {
  return String(s ?? '').replace(/&(#\d+|#x[\da-fA-F]+|[a-zA-Z]+);/g, (m, ent) => {
    if (ent.startsWith('#x')) return String.fromCharCode(parseInt(ent.slice(2), 16));
    if (ent.startsWith('#')) return String.fromCharCode(parseInt(ent.slice(1), 10));
    return HTML_ENTITY_MAP[ent] ?? m;
  });
}

export function safePreviewHref(href) {
  const s = String(href || '').trim();
  return /^(https?:|tg:|mailto:)/i.test(s) ? s : '';
}

function parseTelegramHtmlText(text) {
  const root = { tag: null, children: [] };
  const stack = [root];
  const re = /<\/?([a-zA-Z][\w-]*)(?:\s+[^>]*)?>/g;
  let last = 0;
  let m;

  const pushText = (value) => {
    if (value) stack[stack.length - 1].children.push(decodeHtmlEntities(value));
  };

  while ((m = re.exec(String(text ?? '')))) {
    pushText(String(text ?? '').slice(last, m.index));
    const raw = m[0];
    const tag = String(m[1] || '').toLowerCase();
    last = re.lastIndex;
    if (!TELEGRAM_HTML_TAGS.has(tag)) {
      pushText(raw);
      continue;
    }
    if (raw.startsWith('</')) {
      const idx = stack.findLastIndex((node) => node.tag === tag);
      if (idx > 0) stack.length = idx;
      continue;
    }
    const hrefMatch = tag === 'a' ? raw.match(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i) : null;
    const rawHref = hrefMatch ? decodeHtmlEntities(hrefMatch[1] || hrefMatch[2] || hrefMatch[3] || '') : '';
    const node = {
      tag,
      attrs: hrefMatch ? { href: safePreviewHref(rawHref) } : {},
      children: [],
    };
    stack[stack.length - 1].children.push(node);
    if (!raw.endsWith('/>')) stack.push(node);
  }
  pushText(String(text ?? '').slice(last));
  return root.children;
}

function findUnescapedMarker(text, marker, start) {
  let i = start;
  while (i < text.length) {
    const at = text.indexOf(marker, i);
    if (at < 0) return -1;
    let slashes = 0;
    for (let j = at - 1; j >= 0 && text[j] === '\\'; j -= 1) slashes += 1;
    if (slashes % 2 === 0) return at;
    i = at + marker.length;
  }
  return -1;
}

function parseTelegramMarkdownV2Text(input) {
  const text = String(input ?? '');
  const nodes = [];
  let plain = '';
  let i = 0;

  const flush = () => {
    if (plain) {
      nodes.push(plain);
      plain = '';
    }
  };

  while (i < text.length) {
    if (text[i] === '\\' && i + 1 < text.length) {
      plain += text[i + 1];
      i += 2;
      continue;
    }

    if (text.startsWith('```', i)) {
      const end = findUnescapedMarker(text, '```', i + 3);
      if (end > i) {
        flush();
        nodes.push({ tag: 'pre', children: [text.slice(i + 3, end)] });
        i = end + 3;
        continue;
      }
    }

    if (text[i] === '`') {
      const end = findUnescapedMarker(text, '`', i + 1);
      if (end > i) {
        flush();
        nodes.push({ tag: 'code', children: [text.slice(i + 1, end)] });
        i = end + 1;
        continue;
      }
    }

    const marker = text.startsWith('__', i) ? '__' : text.startsWith('||', i) ? '||' : text[i];
    const tag = marker === '__' ? 'u'
      : marker === '||' ? 'spoiler'
      : marker === '*' ? 'strong'
      : marker === '_' ? 'em'
      : marker === '~' ? 's'
      : null;
    if (tag) {
      const end = findUnescapedMarker(text, marker, i + marker.length);
      if (end > i) {
        flush();
        nodes.push({ tag, children: parseTelegramMarkdownV2Text(text.slice(i + marker.length, end)) });
        i = end + marker.length;
        continue;
      }
    }

    if (text[i] === '[') {
      const labelEnd = findUnescapedMarker(text, ']', i + 1);
      if (labelEnd > i && text[labelEnd + 1] === '(') {
        const urlEnd = findUnescapedMarker(text, ')', labelEnd + 2);
        if (urlEnd > labelEnd) {
          flush();
          nodes.push({
            tag: 'a',
            attrs: { href: text.slice(labelEnd + 2, urlEnd).replace(/\\(.)/g, '$1') },
            children: parseTelegramMarkdownV2Text(text.slice(i + 1, labelEnd)),
          });
          i = urlEnd + 1;
          continue;
        }
      }
    }

    plain += text[i];
    i += 1;
  }

  flush();
  return nodes;
}

function renderPreviewRichNode(node, key) {
  if (typeof node === 'string') return <React.Fragment key={key}>{node}</React.Fragment>;
  const children = (node.children || []).map((child, i) => renderPreviewRichNode(child, `${key}.${i}`));
  switch (node.tag) {
    case 'b':
    case 'strong':
      return <strong key={key}>{children}</strong>;
    case 'i':
    case 'em':
      return <em key={key}>{children}</em>;
    case 'u':
    case 'ins':
      return <span key={key} style={{ textDecoration: 'underline', textUnderlineOffset: 2 }}>{children}</span>;
    case 's':
    case 'strike':
    case 'del':
      return <span key={key} style={{ textDecoration: 'line-through' }}>{children}</span>;
    case 'code':
      return <code key={key} className="chat-sim__code">{children}</code>;
    case 'pre':
      return <code key={key} className="chat-sim__pre">{children}</code>;
    case 'a': {
      const href = safePreviewHref(node.attrs?.href);
      if (!href) return <span key={key}>{children}</span>;
      return <a key={key} href={href} target="_blank" rel="noreferrer" className="chat-sim__link">{children}</a>;
    }
    case 'spoiler':
      return <span key={key} className="chat-sim__spoiler">{children}</span>;
    default:
      return <React.Fragment key={key}>{children}</React.Fragment>;
  }
}

export function PreviewRichText({ text, format }) {
  const fmt = String(format || '').toLowerCase();
  const nodes = fmt === 'html'
    ? parseTelegramHtmlText(text)
    : (fmt === 'markdown_v2' || fmt === 'markdownv2')
      ? parseTelegramMarkdownV2Text(text)
      : [String(text ?? '')];
  return <>{nodes.map((node, i) => renderPreviewRichNode(node, `pvrt.${i}`))}</>;
}
