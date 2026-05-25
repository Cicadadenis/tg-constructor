import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../utils/cn.js';

const VARIANTS = {
  primary: 'mc-btn--primary',
  secondary: 'mc-btn--secondary',
  ghost: 'mc-btn--ghost',
  danger: 'mc-btn--danger',
};

const SIZES = {
  sm: 'mc-btn--sm',
  md: '',
  lg: 'mc-btn--lg',
};

/**
 * @typedef {object} ButtonProps
 * @property {keyof typeof VARIANTS} [variant]
 * @property {keyof typeof SIZES} [size]
 * @property {boolean} [iconOnly]
 * @property {boolean} [loading]
 * @property {boolean} [asChild]
 */

/**
 * MC Button — Radix Slot + CSS primitives.
 * @param {ButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement>} props
 */
export function Button({
  className,
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  loading = false,
  asChild = false,
  disabled,
  children,
  type = 'button',
  ...rest
}) {
  const Comp = asChild ? Slot : 'button';
  const isDisabled = disabled || loading;

  return (
    <Comp
      type={asChild ? undefined : type}
      className={cn(
        'mc-btn',
        'mc-focus-ring',
        'mc-press',
        VARIANTS[variant],
        SIZES[size],
        iconOnly && 'mc-btn--icon',
        loading && 'mc-loading',
        className,
      )}
      disabled={isDisabled}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      {...rest}
    >
      {children}
    </Comp>
  );
}

export default Button;
