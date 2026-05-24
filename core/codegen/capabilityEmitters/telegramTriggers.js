/**
 * Telegram transport trigger capability emitters (decorators).
 */

import { pyQuote } from '../utils.js';
import { callbackKeysMatch, normalizeCallbackData } from '../callbackDataNormalize.js';
import { registerCapabilityEmitter } from '../capabilityPythonRegistry.js';
import { CAPABILITY_TRIGGERS } from '../../capabilities/capabilityIds.ts';

function blockProps(block) {
  return block?.props ?? block?.payload ?? {};
}

function emitCommandStart() {
  return '@router.message(CommandStart())';
}

function emitCommand(block, _ctx) {
  const props = blockProps(block);
  const cmd = String(props.cmd || 'start').replace(/^\//, '');
  return `@router.message(Command(${pyQuote(cmd)}))`;
}

function emitCallback(block, ctx) {
  const props = blockProps(block);
  const data = normalizeCallbackData(props.data || props.callbackData || '');
  const prefix = normalizeCallbackData(props.dataPrefix || props.callbackPrefix || '');
  const label = normalizeCallbackData(props.label || '');
  const inlineCallbacks = ctx?.inlineCallbackData;

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

/** Register telegram.* trigger capability → aiogram decorator emitters. */
export function registerTelegramTriggerEmitters() {
  registerCapabilityEmitter(
    CAPABILITY_TRIGGERS.TELEGRAM_COMMAND_START,
    emitCommandStart,
  );
  registerCapabilityEmitter(
    CAPABILITY_TRIGGERS.TELEGRAM_COMMAND,
    emitCommand,
  );
  registerCapabilityEmitter(
    CAPABILITY_TRIGGERS.TELEGRAM_CALLBACK_QUERY,
    emitCallback,
  );
  registerCapabilityEmitter(
    CAPABILITY_TRIGGERS.TELEGRAM_MESSAGE_VOICE,
    () => '@router.message(F.voice)',
  );
  registerCapabilityEmitter(
    CAPABILITY_TRIGGERS.TELEGRAM_MESSAGE_STICKER,
    () => '@router.message(F.sticker)',
  );
  registerCapabilityEmitter(
    CAPABILITY_TRIGGERS.TELEGRAM_MESSAGE_TEXT,
    () => '@router.message(StateFilter(None), F.text)',
  );
  registerCapabilityEmitter(
    CAPABILITY_TRIGGERS.TELEGRAM_MESSAGE_PHOTO,
    () => '@router.message(F.photo)',
  );
  registerCapabilityEmitter(
    CAPABILITY_TRIGGERS.TELEGRAM_MESSAGE_DOCUMENT,
    () => '@router.message(F.document)',
  );
  registerCapabilityEmitter(
    CAPABILITY_TRIGGERS.TELEGRAM_MESSAGE_LOCATION,
    () => '@router.message(F.location)',
  );
  registerCapabilityEmitter(
    CAPABILITY_TRIGGERS.TELEGRAM_MESSAGE_CONTACT,
    () => '@router.message(F.contact)',
  );
}
