/** @category advanced_routing */
import { handlerColumn, mergeColumns } from './helpers.js';

export const full = mergeColumns(0, [
  handlerColumn(1, [{ id: 'n_global', type: 'global', props: { varname: 'demo_enabled', value: 'true' } }], 20),
  handlerColumn(2, [
    {
      id: 'n_cmds',
      type: 'commands',
      props: { commands: '/start - 🚀\n/help - ❓\n/settings - ⚙️' },
    },
  ], 20),
  handlerColumn(3, [
    { id: 'n_start', type: 'start' },
    { id: 'n_cond', type: 'condition', props: { cond: 'demo_enabled == True' } },
    { id: 'n_welcome', type: 'message', props: { text: '👋 Добро пожаловать!' } },
    { id: 'n_menu_kb', type: 'buttons', props: { rows: '❓ Помощь, ⚙️ Настройки' } },
    { id: 'n_else', type: 'else' },
    { id: 'n_off', type: 'message', props: { text: '⛔ Демо выключено.' } },
  ]),
  handlerColumn(4, [
    { id: 'n_help', type: 'command', props: { cmd: 'help' } },
    { id: 'n_help_msg', type: 'message', props: { text: 'Команды: /start, /help, /settings' } },
  ]),
  handlerColumn(5, [
    { id: 'n_settings', type: 'command', props: { cmd: 'settings' } },
    { id: 'n_set_inline', type: 'inline', props: { buttons: 'RU → lang_ru\nEN → lang_en' } },
    { id: 'n_set_msg', type: 'message', props: { text: '⚙️ Настройки' } },
  ]),
  handlerColumn(6, [
    { id: 'n_cb_lang', type: 'callback', props: { callbackPrefix: 'lang_' } },
    { id: 'n_lang_msg', type: 'message', props: { text: '🌐 lang_* handler' } },
    { id: 'n_lang_goto', type: 'goto', props: { target: 'main' } },
  ]),
  handlerColumn(7, [
    { id: 'n_cb_help', type: 'callback', props: { label: '❓ Помощь' } },
    { id: 'n_cb_help_msg', type: 'message', props: { text: 'Справка по командам.' } },
    { id: 'n_cb_help_goto', type: 'goto', props: { target: 'main' } },
  ]),
]);
