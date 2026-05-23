export const EVENT_HANDLER_TYPES = new Set([
  'start',
  'command',
  'callback',
  'on_text',
  'on_photo',
  'on_voice',
  'voice_received',
  'on_document',
  'document_received',
  'on_sticker',
  'sticker_received',
  'on_location',
  'location_received',
  'on_contact',
  'contact_received',
]);

export const ROOT_CHUNK_TYPES = new Set([
  'version',
  'bot',
  'global',
  'set_global',
  'commands',
  'block',
  'start',
  'command',
  'callback',
  'on_text',
  'on_photo',
  'on_voice',
  'voice_received',
  'on_document',
  'document_received',
  'on_sticker',
  'sticker_received',
  'on_location',
  'location_received',
  'on_contact',
  'contact_received',
  'scenario',
  'step',
  'middleware',
  'else',
]);

export function isEventHandlerType(type) {
  return EVENT_HANDLER_TYPES.has(type);
}

export function isRootChunkType(type) {
  return ROOT_CHUNK_TYPES.has(type);
}
