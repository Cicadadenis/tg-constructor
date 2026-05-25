import React from 'react';
import { cn } from '../utils/cn.js';

/**
 * SaaS side panel / inspector shell.
 */
export function Panel({
  className,
  title,
  header,
  footer,
  children,
  ...rest
}) {
  return (
    <section className={cn('mc-panel', className)} {...rest}>
      {(title || header) && (
        <header className="mc-panel__header">
          {header ?? (title ? <h2 className="mc-panel__title">{title}</h2> : null)}
        </header>
      )}
      <div className="mc-panel__body">{children}</div>
      {footer && <footer className="mc-panel__footer">{footer}</footer>}
    </section>
  );
}

export default Panel;
