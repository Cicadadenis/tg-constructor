/**
 * Registers aiogram 3 block compilers into the codegen registry.
 */

import { registerCompiler } from '../registry.js';
import { compileReply, compileCaption, compileRandom } from './message.js';
import { compileButtons, compileInline, compileDeleteKey } from './buttons.js';
import {
  compileVoiceEvent,
  compileStickerEvent,
  compileTextEvent,
  compilePhotoEvent,
  compileDocumentEvent,
  compileLocationEvent,
  compileContactEvent,
  compileStartEvent,
  compileCommandEvent,
  compileCallbackEvent,
  compileElseEvent,
} from './commands.js';
import {
  compileRemember,
  compileGet,
  compileSave,
  compileSetGlobal,
  compileAsk,
} from './state.js';
import { compileSetVariable, compileGetVariable } from './variables.js';
import { compileRequireRole } from './permissions.js';
import { compileGoto, compileStop, compileLoop, compileDelay, compileTyping, compileLog } from './loops.js';
import { compileForeach } from './foreach.js';
import { compileCondition, compileConditionNot } from './conditions.js';
import {
  compilePhoto,
  compileVideo,
  compileAudio,
  compileSticker,
  compileContact,
  compileLocation,
  compilePoll,
  compileSendFile,
  compilePhotoVar,
  compileDocumentVar,
  compileDocumentSend,
} from './media.js';
import {
  compileVersion,
  compileBotDecl,
  compileGlobalDecl,
  compileCommandsDecl,
} from './bot.js';
import {
  compileDbGet,
  compileDbSet,
  compileDbQuery,
  compileDbInsert,
  compileDbUpdate,
} from './db.js';

/** Register every aiogram 3 visual block type → Python compiler. */
export function registerAllBlockCompilers() {
  const pairs = [
    ['message', compileReply],
    ['reply', compileReply],
    ['caption', compileCaption],
    ['buttons', compileButtons],
    ['inline', compileInline],
    ['db_delete', compileDeleteKey],
    ['delete_key', compileDeleteKey],
    ['on_voice', compileVoiceEvent],
    ['voice_received', compileVoiceEvent],
    ['on_sticker', compileStickerEvent],
    ['sticker_received', compileStickerEvent],
    ['on_text', compileTextEvent],
    ['on_photo', compilePhotoEvent],
    ['photo_received', compilePhotoEvent],
    ['on_document', compileDocumentEvent],
    ['document_received', compileDocumentEvent],
    ['on_location', compileLocationEvent],
    ['location_received', compileLocationEvent],
    ['on_contact', compileContactEvent],
    ['contact_received', compileContactEvent],
    ['start', compileStartEvent],
    ['command', compileCommandEvent],
    ['callback', compileCallbackEvent],
    ['else', compileElseEvent],
    ['remember', compileRemember],
    ['set_variable', compileSetVariable],
    ['get_variable', compileGetVariable],
    ['get', compileGet],
    ['save', compileSave],
    ['set_global', compileSetGlobal],
    ['ask', compileAsk],
    ['document', compileDocumentSend],
    ['goto', compileGoto],
    ['stop', compileStop],
    ['loop', compileLoop],
    ['foreach', compileForeach],
    ['require_role', compileRequireRole],
    ['delay', compileDelay],
    ['pause', compileDelay],
    ['typing', compileTyping],
    ['log', compileLog],
    ['condition', compileCondition],
    ['condition_not', compileConditionNot],
    ['photo', compilePhoto],
    ['video', compileVideo],
    ['audio', compileAudio],
    ['sticker', compileSticker],
    ['contact', compileContact],
    ['location', compileLocation],
    ['poll', compilePoll],
    ['random', compileRandom],
    ['version', compileVersion],
    ['bot', compileBotDecl],
    ['global', compileGlobalDecl],
    ['commands', compileCommandsDecl],
    ['send_file', compileSendFile],
    ['photo_var', compilePhotoVar],
    ['document_var', compileDocumentVar],
    ['db.get', compileDbGet],
    ['db.set', compileDbSet],
    ['db.query', compileDbQuery],
    ['db.insert', compileDbInsert],
    ['db.update', compileDbUpdate],
  ];
  for (const [type, fn] of pairs) registerCompiler(type, fn);
}
