import React from 'react';
import { motion } from 'framer-motion';
import { skeletonPulse, staggerContainer, staggerItem } from '../../design-system/motion/presets.js';
import { useMotionPrefs } from './MotionProvider.jsx';

/**
 * Animated loading placeholder.
 */
export function MotionSkeleton({ variant = 'text', className = '', style }) {
  const { reducedMotion } = useMotionPrefs();
  return (
    <motion.span
      className={`ds-skeleton ds-skeleton--${variant} mc-motion-skeleton ${className}`.trim()}
      style={style}
      aria-hidden
      {...(reducedMotion ? {} : skeletonPulse)}
    />
  );
}

export function MotionSkeletonList({ rows = 4 }) {
  const { reducedMotion } = useMotionPrefs();
  const Wrapper = reducedMotion ? 'div' : motion.div;
  const Item = reducedMotion ? 'div' : motion.div;
  const wrapperProps = reducedMotion
    ? { className: 'ds-skeleton-list' }
    : { className: 'ds-skeleton-list', variants: staggerContainer, initial: 'hidden', animate: 'show' };
  const itemProps = reducedMotion ? {} : { variants: staggerItem };

  return (
    <Wrapper {...wrapperProps} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Item key={i} {...itemProps}>
          <MotionSkeleton variant="row" />
        </Item>
      ))}
    </Wrapper>
  );
}
