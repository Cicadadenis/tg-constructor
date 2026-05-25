/**
 * Shared / reusable automation components — catalog for Production Hub.
 */

export const SHARED_COMPONENT_CATEGORIES = Object.freeze([
  { id: 'messages', icon: '💬', labelKey: 'catMessages' },
  { id: 'inputs', icon: '📝', labelKey: 'catInputs' },
  { id: 'logic', icon: '⑂', labelKey: 'catLogic' },
  { id: 'timing', icon: '⏱', labelKey: 'catTiming' },
]);

/** @type {readonly { id: string, category: string, blockType: string, nameKey: string, descKey: string }[]} */
export const SHARED_COMPONENTS = Object.freeze([
  { id: 'welcome_msg', category: 'messages', blockType: 'message', nameKey: 'welcomeMsg', descKey: 'welcomeMsgDesc' },
  { id: 'cta_buttons', category: 'messages', blockType: 'buttons', nameKey: 'ctaButtons', descKey: 'ctaButtonsDesc' },
  { id: 'ask_contact', category: 'inputs', blockType: 'ask', nameKey: 'askContact', descKey: 'askContactDesc' },
  { id: 'branch_yes_no', category: 'logic', blockType: 'condition', nameKey: 'branchYesNo', descKey: 'branchYesNoDesc' },
  { id: 'delay_2s', category: 'timing', blockType: 'delay', nameKey: 'delay2s', descKey: 'delay2sDesc' },
  { id: 'delay_24h', category: 'timing', blockType: 'delay', nameKey: 'delay24h', descKey: 'delay24hDesc' },
  { id: 'subscriber_tag', category: 'logic', blockType: 'subscriber_tag', nameKey: 'tagStep', descKey: 'tagStepDesc' },
]);

/**
 * Default props for inserting a shared component onto canvas.
 * @param {string} componentId
 */
export function getSharedComponentInsertProps(componentId) {
  const def = SHARED_COMPONENTS.find((c) => c.id === componentId);
  if (!def) return null;
  const defaults = {
    welcome_msg: { text: '👋 Добро пожаловать! Чем можем помочь?' },
    cta_buttons: { rows: 'Начать, Помощь, О нас' },
    ask_contact: { question: 'Оставьте контакт для связи:', varname: 'contact' },
    branch_yes_no: { cond: 'answer == "да"' },
    delay_2s: { seconds: '2' },
    delay_24h: { seconds: '86400' },
    subscriber_tag: { tag: 'engaged' },
  };
  return { type: def.blockType, props: defaults[componentId] || {} };
}
