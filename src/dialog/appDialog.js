/** Imperative API — set by AppDialogProvider. Falls back to native dialogs if unset. */

let dialogApi = null;

export function registerAppDialog(api) {
  dialogApi = api;
}

export function unregisterAppDialog() {
  dialogApi = null;
}

function normalizeOptions(input, defaults = {}) {
  if (typeof input === 'string') {
    return { message: input, ...defaults };
  }
  return { ...defaults, ...input };
}

export function appConfirm(input) {
  const opts = normalizeOptions(input, {
    title: 'Подтвердите действие',
    confirmText: 'OK',
    cancelText: 'Отмена',
    variant: 'default',
  });
  if (dialogApi?.confirm) return dialogApi.confirm(opts);
  return Promise.resolve(window.confirm(opts.message || opts.title));
}

export function appAlert(input) {
  const opts = normalizeOptions(input, {
    title: 'Сообщение',
    confirmText: 'OK',
    variant: 'info',
  });
  if (dialogApi?.alert) return dialogApi.alert(opts);
  window.alert(opts.message || opts.title);
  return Promise.resolve();
}

export function appPrompt(input) {
  const opts = normalizeOptions(input, {
    title: 'Введите значение',
    confirmText: 'OK',
    cancelText: 'Отмена',
    placeholder: '',
    defaultValue: '',
  });
  if (dialogApi?.prompt) return dialogApi.prompt(opts);
  const value = window.prompt(opts.message || opts.title, opts.defaultValue ?? '');
  return Promise.resolve(value);
}
