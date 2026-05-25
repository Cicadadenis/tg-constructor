import React from 'react';

const ICONS = {
  success: '✓',
  error: '!',
  warning: '⚠',
  info: 'ℹ',
};

/**
 * Standard toast surface — success/error/info/warning only (no inline alerts).
 * @param {object} props
 * @param {{ message: string, type?: string, visible?: boolean } | null} props.toast
 * @param {boolean} [props.isMobile]
 */
export default function ToastHost({ toast, isMobile = false }) {
  if (!toast?.message) return null;

  const type = toast.type || 'info';
  const visible = toast.visible !== false;

  return (
    <div
      className={`ds-toast-host ${isMobile ? 'ds-toast-host--mobile' : 'ds-toast-host--desktop'}`}
      style={{ transform: 'translateX(-50%)' }}
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={`ds-toast ds-toast--${type} ${visible ? 'ds-toast--visible' : 'ds-toast--hidden'}`}
        role="status"
      >
        <span className="ds-toast__icon" aria-hidden>{ICONS[type] || ICONS.info}</span>
        <span className="ds-toast__message">{toast.message}</span>
      </div>
    </div>
  );
}
