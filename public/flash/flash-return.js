/**
 * Куда вернуться с /flash/ и /flash/jammer/ (общий origin с Cicada Studio).
 */
(function () {
  const KEY = 'cicada_return_to';

  function safeReturnTo(value) {
    if (!value || typeof value !== 'string') return null;
    const t = value.trim();
    if (!t.startsWith('/') || t.startsWith('//')) return null;
    return t;
  }

  function peekReturnTo() {
    try {
      const fromUrl = safeReturnTo(new URLSearchParams(window.location.search).get('returnTo'));
      if (fromUrl) return fromUrl;
    } catch { /* ignore */ }
    try {
      const fromSession = safeReturnTo(sessionStorage.getItem(KEY));
      if (fromSession) return fromSession;
    } catch { /* ignore */ }
    try {
      return safeReturnTo(localStorage.getItem(KEY));
    } catch { /* ignore */ }
    return null;
  }

  function defaultExitTarget() {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('projectId');
    if (projectId) {
      const q = new URLSearchParams();
      q.set('projectId', projectId);
      const name = params.get('name') || params.get('projectName');
      if (name) q.set('name', name);
      return `/esphome/?${q.toString()}`;
    }
    if (window.location.pathname.includes('/jammer')) {
      return '/esphome/';
    }
    return '/esphome/';
  }

  function navigateExit() {
    const here = `${window.location.pathname}${window.location.search}`;
    const stored = peekReturnTo();
    if (stored && stored !== here) {
      window.location.replace(stored);
      return;
    }
    try {
      if (document.referrer) {
        const ref = new URL(document.referrer);
        if (ref.origin === window.location.origin && `${ref.pathname}${ref.search}` !== here) {
          window.location.replace(document.referrer);
          return;
        }
      }
    } catch { /* ignore */ }
    window.location.replace(defaultExitTarget());
  }

  function handleExitClick(ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    const go = () => {
      if (window.opener && !window.opener.closed) {
        try {
          window.close();
          return;
        } catch { /* ignore */ }
      }
      navigateExit();
    };
    const release = window.CicadaSerialCleanup?.releaseAndForgetSerialPorts;
    if (typeof release === 'function') {
      Promise.resolve(release()).finally(go);
      return;
    }
    go();
  }

  function bindExitButtons() {
    document.querySelectorAll('#exit-btn, button.exit-btn').forEach((btn) => {
      if (btn.dataset.exitBound === '1') return;
      btn.dataset.exitBound = '1';
      btn.addEventListener('click', handleExitClick);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindExitButtons);
  } else {
    bindExitButtons();
  }

  window.CicadaFlashReturn = {
    safeReturnTo,
    peekReturnTo,
    defaultExitTarget,
    navigateExit,
    handleExitClick,
    bindExitButtons,
  };
})();
