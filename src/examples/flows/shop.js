/** @category basic_handlers */
import { handlerColumn, mergeColumns } from './helpers.js';

export const shop = mergeColumns(0, [
  handlerColumn(1, [{ id: 'n_ver', type: 'version', props: { version: '1.0' } }], 20),
  handlerColumn(2, [{ id: 'n_global', type: 'global', props: { varname: 'shop_open', value: 'true' } }], 20),
  handlerColumn(3, [
    {
      id: 'n_cmds',
      type: 'commands',
      props: { commands: '/start - 🚀 Магазин\n/catalog - 📦 Каталог\n/cart - 🛒 Корзина' },
    },
  ], 20),
  handlerColumn(4, [
    { id: 'n_start', type: 'start' },
    { id: 'n_welcome', type: 'message', props: { text: '👋 Добро пожаловать в магазин 🛍️' } },
    { id: 'n_welcome_kb', type: 'buttons', props: { rows: '📦 Каталог, 🛒 Корзина\n❓ Помощь' } },
  ]),
  handlerColumn(5, [
    { id: 'n_cat', type: 'command', props: { cmd: 'catalog' } },
    { id: 'n_cat_msg', type: 'message', props: { text: '📦 Каталог:\n🍎 Яблоки — 100₽' } },
    { id: 'n_cat_kb', type: 'buttons', props: { rows: '🍎 Яблоки — 100₽\n🏠 Главная' } },
  ]),
  handlerColumn(6, [
    { id: 'n_cart', type: 'command', props: { cmd: 'cart' } },
    { id: 'n_cart_msg', type: 'message', props: { text: '🛒 Корзина пуста.' } },
    { id: 'n_cart_kb', type: 'buttons', props: { rows: '📦 Каталог, 🏠 Главная' } },
  ]),
  handlerColumn(7, [
    { id: 'n_cb_home', type: 'callback', props: { label: '🏠 Главная' } },
    { id: 'n_home_msg', type: 'message', props: { text: '🏠 Главное меню' } },
    { id: 'n_home_kb', type: 'buttons', props: { rows: '📦 Каталог, 🛒 Корзина' } },
    { id: 'n_home_goto', type: 'goto', props: { target: 'main' } },
  ]),
  handlerColumn(8, [
    { id: 'n_cb_apple', type: 'callback', props: { label: '🍎 Яблоки — 100₽' } },
    { id: 'n_apple_msg', type: 'message', props: { text: '🍎 Добавлено в корзину!' } },
    { id: 'n_apple_kb', type: 'buttons', props: { rows: '🛒 Корзина, 📦 Каталог' } },
    { id: 'n_apple_goto', type: 'goto', props: { target: 'main' } },
  ]),
]);
