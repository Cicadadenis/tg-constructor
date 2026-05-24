/**
 * Bootstrap capability emitters (triggers + shared actions + block registry).
 */

import { registerCapabilityEmitter } from '../capabilityPythonRegistry.js';
import { registerAllBlockCompilers } from '../blockCompilers/registerAll.js';
import { registerTelegramTriggerEmitters } from './telegramTriggers.js';
import { registerDbCapabilityEmitters } from '../../db/dbCapabilityCodegen.js';
import {
  blockCapabilitiesByType,
} from '../../registry/blockCapabilities.js';
import { getCompiler } from '../registry.js';
import { compileReply } from '../blockCompilers/message.js';

let registered = false;

/** Shared actions used by multiple block types — explicit primary emitter. */
const SHARED_ACTION_EMITTERS = Object.freeze([
  ['send_message', compileReply],
]);

function registerSharedActionEmitters() {
  for (const [actionId, fn] of SHARED_ACTION_EMITTERS) {
    registerCapabilityEmitter(actionId, fn);
  }
}

/**
 * Per-block-type: register action emitters not yet taken (block-specific compilers).
 */
function registerBlockActionEmitters() {
  for (const [blockType, caps] of Object.entries(blockCapabilitiesByType)) {
    const compiler = getCompiler(blockType);
    if (!compiler) continue;
    for (const actionId of caps.actions || []) {
      if (!SHARED_ACTION_EMITTERS.some(([id]) => id === actionId)) {
        registerCapabilityEmitter(actionId, compiler);
      }
    }
  }
}

/**
 * Single bootstrap: block type compilers + capability emitter registry.
 */
export function registerAllCapabilityEmitters() {
  if (registered) return;
  registerAllBlockCompilers();
  registerTelegramTriggerEmitters();
  registerDbCapabilityEmitters();
  registerSharedActionEmitters();
  registerBlockActionEmitters();
  registered = true;
}
