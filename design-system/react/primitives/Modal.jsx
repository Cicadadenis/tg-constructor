import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '../utils/cn.js';
import { Button } from './Button.jsx';

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string} [props.title]
 * @param {React.ReactNode} props.children
 * @param {React.ReactNode} [props.footer]
 * @param {string} [props.description] — aria description
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  contentClassName,
  ...rest
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} {...rest}>
      <Dialog.Portal>
        <Dialog.Overlay className="mc-modal-overlay" />
        <Dialog.Content
          className={cn('mc-modal-content mc-focus-ring', contentClassName)}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {(title || description) && (
            <div className="mc-modal-header">
              {title && (
                <Dialog.Title className="mc-modal-title">{title}</Dialog.Title>
              )}
              {description && (
                <Dialog.Description
                  style={{
                    marginTop: 'var(--mc-space-2)',
                    fontSize: 'var(--mc-font-size-sm)',
                    color: 'var(--mc-color-text-secondary)',
                  }}
                >
                  {description}
                </Dialog.Description>
              )}
            </div>
          )}
          <div className={cn('mc-modal-body', className)}>{children}</div>
          {footer && <div className="mc-modal-footer">{footer}</div>}
          <Dialog.Close asChild>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label="Close"
              style={{
                position: 'absolute',
                top: 'var(--mc-space-4)',
                right: 'var(--mc-space-4)',
              }}
            >
              ×
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default Modal;
