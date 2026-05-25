/**
 * Flow list card metadata — trigger labels, channels (ManyChat-style list).
 */

const TRIGGER_LABELS = {
  en: {
    start: '/start',
    command: 'Command',
    callback: 'Callback',
    on_text: 'Message',
    on_photo: 'Photo',
    on_voice: 'Voice',
    on_document: 'Document',
    else: 'Else',
    scenario: 'Scenario',
  },
  ru: {
    start: '/start',
    command: 'Команда',
    callback: 'Callback',
    on_text: 'Сообщение',
    on_photo: 'Фото',
    on_voice: 'Голос',
    on_document: 'Документ',
    else: 'Иначе',
    scenario: 'Сценарий',
  },
  uk: {
    start: '/start',
    command: 'Команда',
    callback: 'Callback',
    on_text: 'Повідомлення',
    on_photo: 'Фото',
    on_voice: 'Голос',
    on_document: 'Документ',
    else: 'Інакше',
    scenario: 'Сценарій',
  },
};

const ROOT_TYPES = new Set([
  'start', 'command', 'callback', 'else',
  'on_text', 'on_photo', 'on_voice', 'on_document', 'on_sticker', 'on_location', 'on_contact',
]);

/**
 * @param {string} lang
 * @param {object} [graphDocument]
 * @returns {{ triggerLabel: string, nodeCount: number, triggerType: string }}
 */
export function deriveFlowListMeta(lang, graphDocument) {
  const labels = TRIGGER_LABELS[lang === 'en' ? 'en' : lang === 'uk' ? 'uk' : 'ru'];
  if (!graphDocument?.nodes) {
    return { triggerLabel: labels.scenario, nodeCount: 0, triggerType: 'scenario' };
  }
  const nodes = Object.values(graphDocument.nodes || {});
  const roots = nodes.filter((n) => ROOT_TYPES.has(String(n?.type || '').trim()));
  const pick = roots.find((n) => n.type === 'start')
    || roots.find((n) => n.type === 'command')
    || roots[0];
  const type = pick?.type || 'scenario';
  let triggerLabel = labels[type] || labels.scenario;
  if (type === 'command' && pick?.data?.cmd) {
    triggerLabel = `/${String(pick.data.cmd).replace(/^\//, '')}`;
  }
  const visible = nodes.filter((n) => {
    const t = String(n?.type || '').trim();
    return t && !['bot', 'version', 'commands', 'global'].includes(t);
  });
  return { triggerLabel, nodeCount: visible.length, triggerType: type };
}

/** @param {'telegram' | 'instagram' | 'whatsapp'} channel */
export function channelIcon(channel) {
  if (channel === 'instagram') return '📷';
  if (channel === 'whatsapp') return '💬';
  return '✈️';
}
