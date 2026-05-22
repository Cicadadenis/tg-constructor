import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { registerAppDialog, unregisterAppDialog } from './appDialog.js';

const VARIANTS = {
  default: {
    border: 'rgba(62,207,142,0.35)',
    titleColor: '#a7f3d0',
    confirmBg: 'linear-gradient(135deg,#3ecf8e,#0ea5e9)',
    confirmColor: '#0a0f14',
  },
  danger: {
    border: 'rgba(248,113,113,0.4)',
    titleColor: '#fda4af',
    confirmBg: 'linear-gradient(135deg,#fb7185,#ef4444)',
    confirmColor: '#fff',
  },
  warning: {
    border: 'rgba(251,191,36,0.4)',
    titleColor: '#fde68a',
    confirmBg: 'linear-gradient(135deg,#fbbf24,#f59e0b)',
    confirmColor: '#1a1208',
  },
  info: {
    border: 'rgba(96,165,250,0.35)',
    titleColor: '#93c5fd',
    confirmBg: 'linear-gradient(135deg,#60a5fa,#3b82f6)',
    confirmColor: '#fff',
  },
};

const cancelBtnStyle = {
  padding: '10px 16px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.92)',
  cursor: 'pointer',
  fontFamily: 'Syne, system-ui, sans-serif',
  fontSize: 13,
  fontWeight: 600,
};

const confirmBtnStyle = {
  padding: '10px 18px',
  borderRadius: 10,
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'Syne, system-ui, sans-serif',
  fontSize: 13,
  fontWeight: 700,
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
      style={{
        padding: '18px 22px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        fontFamily: 'Syne, system-ui, sans-serif',
        fontWeight: 700,
        fontSize: 16,
        color: theme.titleColor,
        letterSpacing: '0.01em',
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
        background: 'rgba(2,1,12,0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'appDialogFadeIn 0.2s ease',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(480px, 92vw)',
          borderRadius: 16,
          border: `1px solid ${theme.border}`,
          background: 'linear-gradient(160deg, rgba(22,18,38,0.97), rgba(12,10,24,0.98))',
          boxShadow: '0 30px 100px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset',
          overflow: 'hidden',
          animation: 'appDialogSlideIn 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <DialogTitle id="app-dialog-title" variant={dialog.variant}>
          {dialog.title}
        </DialogTitle>
        {dialog.message && (
          <p style={{
            margin: 0,
            padding: '0 22px 18px',
            color: 'rgba(255,255,255,0.88)',
            fontSize: 14,
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
          }}
          >
            {dialog.message}
          </p>
        )}
        {dialog.kind === 'prompt' && (
          <div style={{ padding: '0 22px 18px' }}>
            <input
              ref={inputRef}
              type="text"
              defaultValue={dialog.defaultValue ?? ''}
              placeholder={dialog.placeholder || ''}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  closeDialog(e.currentTarget.value);
                }
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '11px 14px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(0,0,0,0.35)',
                color: '#f8fafc',
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>
        )}
        <div style={{
          padding: '0 22px 22px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          flexWrap: 'wrap',
        }}
        >
          {(dialog.kind === 'confirm' || dialog.kind === 'prompt') && (
            <button type="button" onClick={() => closeDialog(null)} style={cancelBtnStyle}>
              {dialog.cancelText || 'Отмена'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (dialog.kind === 'prompt') {
                closeDialog(inputRef.current?.value ?? '');
                return;
              }
              closeDialog(dialog.kind === 'confirm' ? true : undefined);
            }}
            style={{
              ...confirmBtnStyle,
              background: theme.confirmBg,
              color: theme.confirmColor,
            }}
          >
            {dialog.confirmText || 'OK'}
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
