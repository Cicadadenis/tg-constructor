/**
 * Manifest helpers for esp-web-tools (install-button / install-dialog).
 * @see https://esphome.github.io/esp-web-tools/
 */

/** True when ESPHome YAML enables Improv Wi‑Fi serial provisioning. */
export function yamlSupportsImprovWifi(yamlText) {
  if (!yamlText || typeof yamlText !== 'string') return false;
  return /^\s*(improv_serial|esp32_improv|esp8266_improv)\s*:/m.test(yamlText);
}

/**
 * @param {{
 *   name: string,
 *   version: string,
 *   chipFamilies: string[],
 *   binPath?: string,
 *   offset?: number,
 *   improvWifi?: boolean,
 * }} opts
 */
export function buildEspWebManifest({
  name,
  version,
  chipFamilies,
  binPath = 'esp.bin',
  offset = 0,
  improvWifi = false,
}) {
  const builds = chipFamilies.map((chipFamily) => ({
    chipFamily,
    ...(improvWifi ? {} : { improv: false }),
    parts: [{
      path: binPath,
      offset: chipFamily === 'ESP8266' ? 0 : offset,
    }],
  }));
  return {
    name,
    version,
    new_install_prompt_erase: true,
    ...(improvWifi ? {} : { new_install_improv_wait_time: 0 }),
    builds,
  };
}
