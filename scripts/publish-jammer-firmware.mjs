#!/usr/bin/env node
/**
 * Публикует esp8266_deauther.bin для /flash/jammer/ и /firmware/jammer/.
 * Источник: JAMMER_FIRMWARE_BIN или ./esp8266_deauther.bin в корне проекта.
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initJammerFirmwareOnBoot } from '../services/espFirmwareRoutes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });

const src = path.resolve(
  process.env.JAMMER_FIRMWARE_BIN?.trim() || path.join(root, 'esp8266_deauther.bin'),
);
const dest = path.join(root, 'public/flash/jammer/esp8266_deauther.bin');

if (!fs.existsSync(src)) {
  console.error('[jammer] Файл прошивки не найден:', src);
  console.error('');
  console.error('Положите готовый esp8266_deauther.bin в корень проекта:');
  console.error('  ', path.join(root, 'esp8266_deauther.bin'));
  console.error('или укажите в .env:');
  console.error('  JAMMER_FIRMWARE_BIN=/полный/путь/esp8266_deauther.bin');
  console.error('');
  console.error('Файл не хранится в git (.gitignore). После копирования снова: npm run jammer:publish');
  process.exit(1);
}

const ok = await initJammerFirmwareOnBoot();
if (!ok) {
  console.error('[jammer] Не удалось скопировать прошивку в', dest);
  process.exit(1);
}

const st = fs.statSync(dest);
console.log('[jammer] OK:', dest, `(${Math.round(st.size / 1024)} KB)`);
console.log('[jammer] Перезапуск не обязателен — достаточно обновить страницу /flash/jammer/');
