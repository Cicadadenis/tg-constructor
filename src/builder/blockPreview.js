import { formatKeyboardCanvasPreview } from './inline_keyboard/inline_keyboard_model.js';

function countKeyboardButtonsFromProps(p) {
  if (Array.isArray(p?.rows)) {
    return p.rows.reduce((n, row) => n + (row?.buttons?.length || 0), 0);
  }
  return 0;
}

function countUiKeyboardAttachments(uiAtt) {
  if (!uiAtt || typeof uiAtt !== 'object') return 0;
  const buttons = Array.isArray(uiAtt.buttons) ? uiAtt.buttons.length : 0;
  const inline = Array.isArray(uiAtt.inline) ? uiAtt.inline.length : 0;
  const replies = Array.isArray(uiAtt.replies) ? uiAtt.replies.length : 0;
  return buttons + inline + replies;
}

function hasKeyboardProps(p) {
  return Boolean(
    String(p?.rows || '').trim()
    || String(p?.buttons || '').trim()
    || String(p?.markup || '').includes('reply'),
  );
}

function mediaPreviewLabel(type, p, uiBtnCount) {
  const cap = String(p?.caption || '').trim();
  const url = String(p?.url || p?.file_id || p?.varname || '').trim();
  const base = cap
    ? cap.slice(0, 24)
    : (url ? url.slice(0, 20) : type);
  const kb = hasKeyboardProps(p) || uiBtnCount > 0;
  const kbSuffix = uiBtnCount > 0 ? ` · ${uiBtnCount} кн.` : '';
  if (kb) return `${base} + кнопки${kbSuffix}`;
  return `${base}${kbSuffix}`;
}

/**
 * Block preview text for canvas nodes (no React / BuilderComponents deps).
 * @param {string} type
 * @param {object} [props]
 * @param {object} [meta] — GraphDocument node.meta (uiAttachments, …)
 */
export function getPreview(type, props, meta) {
  const p = props || {};
  const graphKbCount = Number(meta?.keyboardButtonCount) || 0;
  const uiBtnCount = graphKbCount || countUiKeyboardAttachments(meta?.uiAttachments);
  const uiKbSuffix = uiBtnCount > 0 ? ` · ${uiBtnCount} кн.` : '';
  switch (type) {
    case 'version': return `v${p.version || '1.0'}`;
    case 'bot': return (p.token || 'TOKEN').slice(0, 20);
    case 'commands': return (p.commands || '').split('\n')[0]?.slice(0, 28) || '';
    case 'global': return `${p.varname || ''} = ${p.value || ''}`;
    case 'block': return p.name || '';
    case 'use': return p.blockname || '';
    case 'middleware': return p.type === 'before' ? 'до каждого' : 'после каждого';
    case 'message':
    case 'reply': {
      const markup = p.markup || (p.md ? 'md' : '');
      const prefix = markup ? `[${markup}] ` : '';
      const kb = hasKeyboardProps(p) || uiBtnCount > 0;
      if (kb) {
        return `${prefix}"${(p.text || '').slice(0, 20)}" + кнопки${uiKbSuffix}`;
      }
      return `${prefix}"${(p.text || '').slice(0, 28)}"${uiKbSuffix}`;
    }
    case 'buttons': return (p.rows || '').split('\n')[0]?.slice(0, 28) || '';
    case 'inline_keyboard':
    case 'reply_keyboard': {
      const preview = formatKeyboardCanvasPreview(p, type);
      if (preview) return preview;
      const n = uiBtnCount || countKeyboardButtonsFromProps(p);
      return n > 0 ? `${type === 'reply_keyboard' ? 'Reply' : 'Inline'} · ${n} кн.` : 'Клавиатура';
    }
    case 'inline': {
      const row = String(p.buttons || '').split('\n')[0] || '';
      const label = row.split('|')[0]?.trim() || 'Inline';
      const kb = hasKeyboardProps(p) || uiBtnCount > 0;
      return kb ? `${label.slice(0, 20)} + кнопки${uiKbSuffix}` : label.slice(0, 28);
    }
    case 'inline_db': return `"${p.key || 'категории'}" → ${p.callbackPrefix || 'callback:'}`;
    case 'command': return `/${p.cmd || 'start'}`;
    case 'callback': return `"${p.label || 'Кнопка'}"`;
    case 'condition': return p.cond?.slice(0, 28) || '';
    case 'condition_not': return p.cond ? `не ${p.cond}`.slice(0, 28) : '';
    case 'else': return 'иначе';
    case 'switch': return `${p.varname || 'текст'}: ...`;
    case 'ask': return `"${(p.question || '').slice(0, 24)}"`;
    case 'remember': return `${p.varname || ''} = ${p.value || ''}`;
    case 'get': return `"${p.key || ''}" → ${p.varname || ''}`;
    case 'save': return `"${p.key || ''}" = ${p.value || ''}`;
    case 'set_global': return `${p.varname || ''} = ${p.value || ''}`;
    case 'goto': return `→ "${p.target || ''}"`;
    case 'delay': return `${p.seconds || '2'}с`;
    case 'typing': return `${p.seconds || '1'}с`;
    case 'http': return `${p.method || 'GET'} ${(p.url || '').slice(0, 20)}`;
    case 'scenario': return p.name || '';
    case 'step': return p.name || '';
    case 'menu': return p.title || '';
    case 'log': return `[${p.level || 'info'}]`;
    case 'notify': return (p.text || '').slice(0, 24);
    case 'payment': return `${p.provider || 'stripe'} ${p.amount || ''}`;
    case 'analytics': return p.event || '';
    case 'loop': return p.mode === 'while' ? `пока ${p.cond || '...'}` : `×${p.count || '3'}`;
    case 'photo':
    case 'photo_var':
    case 'video':
    case 'audio':
    case 'document':
    case 'document_var':
    case 'media':
      return mediaPreviewLabel(type, p, uiBtnCount);
    case 'sticker': return mediaPreviewLabel('sticker', { file_id: p.file_id || 'FILE_ID' }, uiBtnCount);
    case 'contact': {
      const base = `${p.first_name || ''} ${p.phone || ''}`.trim() || 'контакт';
      return uiBtnCount > 0 ? `${base} + кнопки · ${uiBtnCount} кн.` : base;
    }
    case 'location': {
      const base = `${p.lat || '0'}, ${p.lon || '0'}`;
      return uiBtnCount > 0 ? `${base} + кнопки · ${uiBtnCount} кн.` : base;
    }
    case 'poll': {
      const base = (p.question || '').slice(0, 28);
      return uiBtnCount > 0 ? `${base} + кнопки · ${uiBtnCount} кн.` : base;
    }
    case 'send_file': return mediaPreviewLabel('file', { url: p.file }, uiBtnCount);
    case 'forward_msg': {
      const mode = p.mode || (p.target ? 'message' : 'photo');
      if (mode === 'message') return p.target ? `→ ${p.target}` : 'сообщение';
      return mode;
    }
    case 'on_photo': return 'входящее фото';
    case 'on_voice': return 'голосовое';
    case 'on_document': return 'входящий документ';
    case 'on_sticker': return 'стикер';
    case 'on_location': return 'геолокация';
    case 'on_contact': return 'контакт';
    default: return '';
  }
}
