/** Открывается в новой вкладке с лендинга (кнопка «ESPHome Конструктор»). */
const PUBLIC_ESPHOME_PATH = '/esphome/';

/** Локальная копия на машине разработчика (только при npm run dev на localhost). */
const LOCAL_ESPHOME_FILE =
  'file:///C:/Users/denis/Downloads/esphome-constructor-main/index.html';

export function getEsphomeConstructorUrl({ projectId = null, projectName = null } = {}) {
  const fromEnv = import.meta.env.VITE_ESPHOME_CONSTRUCTOR_URL?.trim();
  let base = fromEnv || PUBLIC_ESPHOME_PATH;
  if (!fromEnv && typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      base = LOCAL_ESPHOME_FILE;
    }
  }
  if (base.startsWith('file:')) return base;
  const params = new URLSearchParams();
  if (projectId) params.set('projectId', String(projectId));
  if (projectName) params.set('name', String(projectName));
  const q = params.toString();
  return q ? `${base}${base.includes('?') ? '&' : '?'}${q}` : base;
}

export function openEsphomeConstructor(opts = {}) {
  window.open(getEsphomeConstructorUrl(opts), '_blank', 'noopener,noreferrer');
}
