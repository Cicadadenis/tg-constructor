/**
 * Module-level aiogram bootstrap: Bot, Dispatcher, commands, main().
 */

import { pyQuote } from './utils.js';

export function compileBot(token) {
  const t = pyQuote(String(token || 'YOUR_BOT_TOKEN').trim() || 'YOUR_BOT_TOKEN');
  return [
    `bot = Bot(token=${t})`,
    'dp = Dispatcher()',
    'router = Router()',
  ].join('\n');
}

/**
 * @param {{ command: string, description: string }[]} commands
 */
export function compileCommands(commands) {
  if (!commands?.length) return '';
  const items = commands
    .map(
      (c) =>
        `        BotCommand(command=${pyQuote(c.command.replace(/^\//, ''))}, description=${pyQuote(c.description)})`,
    )
    .join(',\n');
  return [
    'async def set_commands(bot: Bot):',
    '    await bot.set_my_commands([',
    items,
    '    ])',
    '',
  ].join('\n');
}

export function compileMain(includeSetCommands = false) {
  const lines = [
    'async def main():',
    '    dp.include_router(router)',
  ];
  if (includeSetCommands) lines.push('    await set_commands(bot)');
  lines.push('    await dp.start_polling(bot)');
  lines.push('');
  lines.push("if __name__ == '__main__':");
  lines.push('    asyncio.run(main())');
  return lines.join('\n');
}
