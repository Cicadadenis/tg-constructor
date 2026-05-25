import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../utils/cn.js';

/**
 * Provider — wrap app subtree once when using tooltips.
 */
export function TooltipProvider({ children, delayDuration = 300, ...rest }) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} {...rest}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.content
 * @param {React.ReactNode} props.children — trigger
 * @param {'top'|'right'|'bottom'|'left'} [props.side]
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  className,
  ...rest
}) {
  return (
    <TooltipPrimitive.Root {...rest}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn('mc-tooltip-content', className)}
        >
          {content}
          <TooltipPrimitive.Arrow className="mc-tooltip-arrow" width={10} height={5} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export default Tooltip;
