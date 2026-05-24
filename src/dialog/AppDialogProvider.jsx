import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { registerAppDialog, unregisterAppDialog } from './appDialog.js';

const VARIANTS = {
  default: {
    border: 'var(--color-border)',
    titleColor: 'var(--color-text)',
    confirmClass: 'ds-btn ds-btn--primary',
  },
  danger: {
    border: 'var(--color-danger)',
    titleColor: 'var(--color-danger)',
    confirmClass: 'ds-btn ds-btn--danger',
  },
  warning: {
    border: 'var(--color-warning)',
    titleColor: 'var(--color-warning)',
    confirmClass: 'ds-btn ds-btn--primary',
  },
  info: {
    border: 'var(--color-primary-border)',
    titleColor: 'var(--color-primary)',
    confirmClass: 'ds-btn ds-btn--primary',
  },
};

function normalizeDialog(input, defaults) {
  if (typeof input === 'string') return { message: input, ...defaults };
  return { ...defaults, ...input };
}

function DialogTitle({ id, variant, children }) {
  const theme = VARIANTS[variant] || VARIANTS.default;
  return (
    <div
      id={id}
      className="ds-h2"
      style={{
        padding: 'var(--space-2)',
        paddingBottom: 'var(--space-1)',
        margin: 0,
        fontSize: 'var(--font-size-h2)',
        color: theme.titleColor,
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {children}
    </div>
  );
}

export function AppDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const inputRef = useRef(null);

  const closeDialog = useCallback((result) => {
    setDialog((current) => {
      current?.resolve?.(result);
      return null;
    });
  }, []);

  const confirm = useCallback((input) => new Promise((resolve) => {
    setDialog({
      kind: 'confirm',
      ...normalizeDialog(input, {
        title: 'Подтвердите действие',
        confirmText: 'OK',
        cancelText: 'Отмена',
        variant: 'default',
      }),
      resolve,
    });
  }), []);

  const alert = useCallback((input) => new Promise((resolve) => {
    setDialog({
      kind: 'alert',
      ...normalizeDialog(input, {
        title: 'Сообщение',
        confirmText: 'OK',
        variant: 'info',
      }),
      resolve: () => resolve(),
    });
  }), []);

  const prompt = useCallback((input) => new Promise((resolve) => {
    setDialog({
      kind: 'prompt',
      ...normalizeDialog(input, {
        title: 'Введите значение',
        confirmText: 'OK',
        cancelText: 'Отмена',
        placeholder: '',
        defaultValue: '',
      }),
      resolve,
    });
  }), []);

  useEffect(() => {
    registerAppDialog({ confirm, alert, prompt });
    return () => unregisterAppDialog();
  }, [confirm, alert, prompt]);

  useEffect(() => {
    if (!dialog || dialog.kind !== 'prompt') return undefined;
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    });
    return () => cancelAnimationFrame(id);
  }, [dialog]);

  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDialog(dialog.kind === 'alert' ? undefined : null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, closeDialog]);

  const theme = VARIANTS[dialog?.variant] || VARIANTS.default;

  const overlay = dialog && typeof document !== 'undefined' ? createPortal(
    <div
      role="presentation"
      onClick={() => closeDialog(dialog.kind === 'alert' ? undefined : null)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10650,
        background: 'var(--color-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-3)',
        animation: 'appDialogFadeIn 0.2s ease',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="ds-card"
        style={{
          width: 'min(480px, 92vw)',
          borderRadius: 'var(--radius-lg)',
          border: `1px solid ${theme.border}`,
          background: 'var(--color-surface)',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
          animation: 'appDialogSlideIn 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <DialogTitle id="app-dialog-title" variant={dialog.variant}>
          {dialog.title}
        </DialogTitle>
        {dialog.message && (
          <p className="ds-body" style={{
            margin: 0,
            padding: '0 var(--space-2) var(--space-2)',
            color: 'var(--color-text-secondary)',
          }}
          >
            {dialog.message}
          </p>
        )}
        {dialog.kind === 'prompt' && (
          <div style={{ padding: '0 var(--space-2) var(--space-2)' }}>
            <input
              ref={inputRef}
              className="ds-input"
              type="text"
              defaultValue={dialog.defaultValue ?? ''}
              placeholder={dialog.placeholder ?? ''}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  closeDialog(e.target.value);
                }
              }}
            />
          </div>
        )}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 'var(--space-1)',
          padding: 'var(--space-2)',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-surface-muted)',
        }}
        >
          {dialog.kind !== 'alert' && (
            <button
              type="button"
              className="ds-btn ds-btn--ghost"
              onClick={() => closeDialog(null)}
            >
              {dialog.cancelText}
            </button>
          )}
          <button
            type="button"
            className={theme.confirmClass}
            onClick={() => {
              if (dialog.kind === 'prompt') {
                closeDialog(inputRef.current?.value ?? '');
                return;
              }
              closeDialog(true);
            }}
          >
            {dialog.confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      {children}
      {overlay}
    </>
  );
}
