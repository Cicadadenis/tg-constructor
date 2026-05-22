const FLASH_PATH = '/flash';

async function postFirmwareJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return response;
}

export function getEspFlashUrl({ projectId = null, projectName = null } = {}) {
  const params = new URLSearchParams();
  if (projectId) params.set('projectId', String(projectId));
  if (projectName) params.set('name', String(projectName));
  const q = params.toString();
  return q ? `${FLASH_PATH}?${q}` : FLASH_PATH;
}

export async function buildEspFirmware({ projectId = null, projectName = null, yaml = null } = {}) {
  const body = {
    projectId: projectId || undefined,
    name: projectName || undefined,
    yaml: yaml || undefined,
  };
  const response = await postFirmwareJson('/api/firmware/build', body);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || `Ошибка сборки (HTTP ${response.status})`);
    err.log = data.log;
    err.hint = data.hint;
    throw err;
  }
  return data;
}

export async function openEspFlashPage(opts = {}) {
  const { projectId, projectName } = opts;
  if (projectId) {
    try {
      await postFirmwareJson('/api/firmware/refresh', {
        projectId,
        name: projectName || undefined,
      });
    } catch {
      // прошивка может отсутствовать до первой сборки
    }
  }
  window.open(getEspFlashUrl(opts), '_blank', 'noopener,noreferrer');
}
