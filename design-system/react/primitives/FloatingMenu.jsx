import React from 'react';
import { cn } from '../utils/cn.js';

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.label] — aria-label for menu
 */
export function FloatingMenu({ className, children, label = 'Menu', ...rest }) {
  return (
    <div
      role="menu"
      aria-label={label}
      className={cn('mc-floating-menu', 'mc-animate-fade-in', className)}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * @param {object} props
 * @param {React.ReactNode} [props.icon]
 */
export function FloatingMenuItem({
  className,
  icon,
  children,
  disabled,
  ...rest
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn('mc-floating-menu__item', 'mc-focus-ring', className)}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function FloatingMenuSeparator({ className }) {
  return <div role="separator" className={cn('mc-floating-menu__separator', className)} />;
}

export default FloatingMenu;
