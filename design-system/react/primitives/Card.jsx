import React from 'react';
import { cn } from '../utils/cn.js';

/**
 * @param {object} props
 * @param {boolean} [props.padding]
 * @param {boolean} [props.interactive]
 * @param {boolean} [props.flat]
 */
export function Card({
  className,
  padding = false,
  interactive = false,
  flat = false,
  children,
  ...rest
}) {
  return (
    <div
      className={cn(
        'mc-card',
        padding && 'mc-card--padding',
        interactive && 'mc-card--interactive mc-hover-lift',
        flat && 'mc-card--flat',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export default Card;
