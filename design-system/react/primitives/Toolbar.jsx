import React from 'react';
import { cn } from '../utils/cn.js';

export function Toolbar({ className, brand, actions, children, ...rest }) {
  return (
    <header className={cn('mc-toolbar', className)} role="toolbar" {...rest}>
      {brand && <div className="mc-toolbar__brand">{brand}</div>}
      {children}
      {actions && <div className="mc-toolbar__actions">{actions}</div>}
    </header>
  );
}

export function ToolbarDivider({ className }) {
  return <div className={cn('mc-toolbar__divider', className)} aria-hidden />;
}

export default Toolbar;
