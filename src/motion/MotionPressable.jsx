import React from 'react';
import { motion } from 'framer-motion';
import { pressableMotion } from '../../design-system/motion/presets.js';
import { useMotionPrefs } from './MotionProvider.jsx';

/**
 * Button / icon with spring hover-tap (Raycast-style).
 */
export function MotionPressable({
  as: Component = motion.button,
  className = '',
  children,
  disabled = false,
  ...rest
}) {
  const { reducedMotion } = useMotionPrefs();
  const motionProps = reducedMotion || disabled
    ? {}
    : pressableMotion;

  return (
    <Component
      type={Component === motion.button ? 'button' : undefined}
      className={className}
      disabled={disabled}
      {...motionProps}
      {...rest}
    >
      {children}
    </Component>
  );
}
