import React from 'react';
import { cn } from '../utils/cn.js';

const inputId = () => `mc-input-${Math.random().toString(36).slice(2, 9)}`;

/**
 * @param {object} props
 * @param {string} [props.label]
 * @param {string} [props.hint]
 * @param {string} [props.error]
 */
export function Input({
  className,
  label,
  hint,
  error,
  id: idProp,
  disabled,
  ...rest
}) {
  const id = idProp || inputId();
  const invalid = Boolean(error);

  return (
    <div className={cn('mc-input-field', className)}>
      {label && (
        <label htmlFor={id} className="mc-input-label">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn('mc-input', 'mc-focus-ring', invalid && 'mc-invalid')}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={
          [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
        }
        {...rest}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="mc-input-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mc-input-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default Input;
