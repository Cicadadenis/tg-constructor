/**
 * PRO ≥ 2 недель — сборка bin и прошивка глушилки (ESPHome).
 * Данные о подписке — как в Cicada Studio: cicada_session + /api/me.
 */
window.CicadaEspAccess = (function () {
  const Sub = function () { return window.CicadaStudioSubscription; };
  let access = null;
  let loading = true;
  let loadPromise = null;
  let bannerEl = null;

  const JAMMER_HREF = '/flash/jammer/';
  const MIN_DAYS = 14;
  const PREMIUM_CONTROLS = [
    { id: 'buildBinBtn', kind: 'build' },
    { id: 'jammerFlashLink', kind: 'jammer', anchor: true },
  ];

  function subscribeUrl() {
    const origin = window.location.origin || 'https://cicada-studio.online';
    return origin + '/?profile=subscription';
  }

  function loginUrl() {
    const rt = location.pathname + location.search;
    try { sessionStorage.setItem('cicada_return_to', rt); } catch { /* ignore */ }
    return '/?login=1&returnTo=' + encodeURIComponent(rt);
  }

  function deniedMessage(a, kind) {
    a = a || access || {};
    const min = a.minDays || MIN_DAYS;
    const jammerOnly = kind === 'jammer';
    const feature = jammerOnly
      ? 'Прошивка ESP8266 · Глушилка доступна'
      : 'Сборка прошивки и прошивка глушилки доступны';
    if (a.reason === 'auth') {
      return 'Войдите в Cicada Studio, чтобы открыть прошивку ESP8266.';
    }
    if (a.daysLeft > 0 && a.daysLeft < min) {
      return (
        feature + ' при подписке PRO от ' + min + ' дней. ' +
        'Сейчас осталось ' + a.daysLeft + ' дн. — оформите тариф «2 недели» или дольше.'
      );
    }
    return (
      feature + ' при активной подписке PRO от ' + min + ' дней ' +
      '(тариф «2 недели» или дольше).'
    );
  }

  async function load() {
    if (loadPromise) return loadPromise;
    loading = true;
    loadPromise = (async function () {
      try {
        const sub = Sub();
        if (!sub) throw new Error('CicadaStudioSubscription missing');
        access = await sub.resolveEspAccess(MIN_DAYS);
      } catch {
        const cached = Sub()?.readSession?.();
        access = cached
          ? Sub().espAccessFromUser(cached, MIN_DAYS)
          : { allowed: false, daysLeft: 0, minDays: MIN_DAYS, reason: 'no_pro' };
      } finally {
        loading = false;
        applyUi();
      }
      return access;
    })();
    return loadPromise;
  }

  function isAllowed() {
    return Boolean(!loading && access && access.allowed);
  }

  function showPremiumModal(kind) {
    if (access?.reason === 'auth') {
      location.href = loginUrl();
      return;
    }
    const overlay = document.getElementById('premiumOverlay');
    const textEl = document.getElementById('premiumModalText');
    const buyEl = document.getElementById('premiumModalBuyBtn');
    const msg = deniedMessage(access, kind);
    if (!overlay) {
      alert(msg);
      window.open(subscribeUrl(), '_blank', 'noopener,noreferrer');
      return;
    }
    if (textEl) textEl.textContent = msg;
    if (buyEl) buyEl.href = subscribeUrl();
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function closePremiumModal() {
    const overlay = document.getElementById('premiumOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  async function ensureAllowedAsync(kind) {
    await load();
    if (access?.reason === 'auth') {
      location.href = loginUrl();
      return false;
    }
    if (isAllowed()) return true;
    showPremiumModal(kind || 'build');
    return false;
  }

  function ensureAllowed() {
    void ensureAllowedAsync();
    return false;
  }

  async function handlePremiumClick(e, kind) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    }
    const ok = await ensureAllowedAsync(kind || 'build');
    if (!ok) return false;
    if (kind === 'jammer') {
      window.open(JAMMER_HREF, '_blank', 'noopener,noreferrer');
    }
    return true;
  }

  function onPremiumClick(e, kind) {
    void handlePremiumClick(e, kind);
    return false;
  }

  function ensureLockIcon(el) {
    if (!el || el.querySelector('.premium-lock-badge')) return;
    const badge = document.createElement('span');
    badge.className = 'premium-lock-badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.innerHTML = '<i data-lucide="lock"></i>';
    el.classList.add('has-premium-lock');
    el.appendChild(badge);
  }

  function removeLockIcon(el) {
    if (!el) return;
    const badge = el.querySelector('.premium-lock-badge');
    if (badge) badge.remove();
    el.classList.remove('has-premium-lock');
  }

  function lockAnchor(el) {
    if (!el || el.tagName !== 'A') return;
    const href = el.getAttribute('href');
    if (href && href !== '#') {
      el.dataset.premiumHref = href;
    } else if (!el.dataset.premiumHref) {
      el.dataset.premiumHref = JAMMER_HREF;
    }
    if (el.target && !el.dataset.premiumTarget) {
      el.dataset.premiumTarget = el.target;
    }
    el.removeAttribute('target');
    el.setAttribute('href', '#');
    el.setAttribute('role', 'button');
  }

  function unlockAnchor(el) {
    if (!el || el.tagName !== 'A') return;
    const href = el.dataset.premiumHref || JAMMER_HREF;
    el.setAttribute('href', href);
    delete el.dataset.premiumHref;
    if (el.dataset.premiumTarget) {
      el.target = el.dataset.premiumTarget;
      delete el.dataset.premiumTarget;
    } else {
      el.target = '_blank';
    }
    el.removeAttribute('role');
    el.title = 'Прошивка ESP8266 Deauther';
  }

  function bindLockedClick(el, kind) {
    if (!el || el.dataset.premiumBound === '1') return;
    el.dataset.premiumBound = '1';
    el.addEventListener('click', function (e) {
      if (isAllowed()) return;
      void handlePremiumClick(e, kind || 'build');
    }, true);
  }

  function setControlLocked(el, locked, kind, anchor) {
    if (!el) return;
    if (locked) {
      el.classList.add('premium-locked');
      el.setAttribute('aria-disabled', 'true');
      el.title = 'Требуется подписка PRO от ' + ((access && access.minDays) || MIN_DAYS) + ' дней';
      ensureLockIcon(el);
      if (anchor) lockAnchor(el);
      bindLockedClick(el, kind || 'build');
    } else {
      el.classList.remove('premium-locked');
      el.removeAttribute('aria-disabled');
      if (anchor) {
        unlockAnchor(el);
      } else {
        el.title = '';
      }
      removeLockIcon(el);
    }
  }

  function renderBanner() {
    if (!bannerEl) {
      bannerEl = document.getElementById('esp-premium-banner');
    }
    if (!bannerEl) return;
    if (loading || isAllowed()) {
      bannerEl.hidden = true;
      bannerEl.innerHTML = '';
      return;
    }
    bannerEl.hidden = false;
    bannerEl.innerHTML =
      '<div class="esp-premium-banner__inner">' +
        '<span class="esp-premium-banner__icon" aria-hidden="true"><i data-lucide="lock"></i></span>' +
        '<p class="esp-premium-banner__text">' + deniedMessage() + '</p>' +
        '<a class="esp-premium-banner__link btn btn-primary btn-small" href="' + subscribeUrl() + '" target="_blank" rel="noopener">Купить подписку</a>' +
      '</div>';
  }

  function applyUi() {
    const locked = loading || !isAllowed();
    PREMIUM_CONTROLS.forEach(function (cfg) {
      const el = document.getElementById(cfg.id);
      setControlLocked(el, locked, cfg.kind, cfg.anchor);
    });
    renderBanner();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  async function init() {
    applyUi();
    await load();
    if (access?.reason === 'auth') {
      location.href = loginUrl();
      return access;
    }
    const overlay = document.getElementById('premiumOverlay');
    if (overlay && !overlay.dataset.premiumBound) {
      overlay.dataset.premiumBound = '1';
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closePremiumModal();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay.classList.contains('open')) closePremiumModal();
      });
    }
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        loadPromise = null;
        load();
      }
    });
    window.addEventListener('focus', function () {
      loadPromise = null;
      load();
    });
    return access;
  }

  return {
    init,
    load,
    applyUi,
    isAllowed,
    ensureAllowed,
    ensureAllowedAsync,
    handlePremiumClick,
    onPremiumClick,
    showPremiumModal,
    closePremiumModal,
    subscribeUrl,
    getAccess: function () { return access; },
    deniedMessage,
  };
})();
