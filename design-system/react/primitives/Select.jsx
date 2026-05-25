import React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { cn } from '../utils/cn.js';

/**
 * Radix Select with MC styling.
 * @param {object} props
 * @param {string} [props.placeholder]
 * @param {{ value: string, label: string, disabled?: boolean }[]} props.options
 * @param {string} [props.value]
 * @param {(value: string) => void} [props.onValueChange]
 * @param {string} [props.label]
 */
export function Select({
  className,
  label,
  placeholder = 'Select…',
  options = [],
  value,
  onValueChange,
  disabled,
  name,
  ...rest
}) {
  const id = React.useId();

  return (
    <div className={cn('mc-select-field', className)}>
      {label && (
        <label htmlFor={id} className="mc-input-label">
          {label}
        </label>
      )}
      <SelectPrimitive.Root
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        name={name}
        {...rest}
      >
        <SelectPrimitive.Trigger
          id={id}
          className="mc-select-trigger mc-focus-ring"
          aria-label={label || placeholder}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon aria-hidden>▾</SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="mc-select-content"
            position="popper"
            sideOffset={6}
          >
            <SelectPrimitive.Viewport>
              {options.map((opt) => (
                <SelectPrimitive.Item
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  className="mc-select-item mc-focus-ring"
                >
                  <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}

export default Select;
