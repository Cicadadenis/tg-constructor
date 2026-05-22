const RETURN_TO_KEY = 'cicada_return_to';

/** Safe in-app return path after Cicada Studio login (blocks open redirects). */
export function safeReturnTo(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  return trimmed;
}

export function rememberReturnTo(path) {
  const safe = safeReturnTo(path);
  if (!safe) return;
  try {
    sessionStorage?.setItem(RETURN_TO_KEY, safe);
  } catch {
    // ignore quota / private mode
  }
  try {
    localStorage?.setItem(RETURN_TO_KEY, safe);
  } catch {
    // ignore
  }
}

export function peekReturnTo() {
  if (typeof window !== 'undefined') {
    const fromUrl = safeReturnTo(new URLSearchParams(window.location.search).get('returnTo'));
    if (fromUrl) return fromUrl;
  }
  try {
    const fromSession = safeReturnTo(sessionStorage?.getItem(RETURN_TO_KEY));
    if (fromSession) return fromSession;
  } catch {
    // ignore
  }
  try {
    return safeReturnTo(localStorage?.getItem(RETURN_TO_KEY));
  } catch {
    return null;
  }
}

export function clearRememberedReturnTo() {
  try {
    sessionStorage?.removeItem(RETURN_TO_KEY);
  } catch {
    // ignore
  }
  try {
    localStorage?.removeItem(RETURN_TO_KEY);
  } catch {
    // ignore
  }
}

/** User opened Studio after login / OAuth / explicit ?returnTo= (not a normal visit to /). */
export function hasReturnToIntent() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('login') === '1') return true;
  if (params.get('oauth_login')) return true;
  return Boolean(safeReturnTo(params.get('returnTo')));
}

/** Persist returnTo from the current URL (call on login landing). */
export function captureReturnToFromUrl() {
  if (typeof window === 'undefined') return null;
  const fromUrl = safeReturnTo(new URLSearchParams(window.location.search).get('returnTo'));
  if (fromUrl) rememberReturnTo(fromUrl);
  return fromUrl || peekReturnTo();
}

/** Redirect to remembered return path (full navigation — do not update React state before this). */
export function redirectIfReturnTo() {
  if (typeof window === 'undefined') return false;
  const returnTo = peekReturnTo();
  if (!returnTo) return false;
  clearRememberedReturnTo();
  window.location.replace(returnTo);
  return true;
}

export function studioLoginUrl(returnPath) {
  const path =
    returnPath ||
    (typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '/');
  rememberReturnTo(path);
  return `/?login=1&returnTo=${encodeURIComponent(path)}`;
}
