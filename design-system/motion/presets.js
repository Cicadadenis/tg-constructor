/**
 * Framer Motion presets — use with motion.* components (optional dependency).
 * Durations/easings mirror CSS tokens in design-system/tokens/motion.css.
 */

export const MC_MOTION_DURATION = {
  fast: 0.12,
  base: 0.18,
  slow: 0.24,
  slower: 0.32,
};

export const MC_MOTION_EASE = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.4, 0, 0.2, 1],
  spring: [0.34, 1.2, 0.64, 1],
};

/** @type {import('framer-motion').Variants} */
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: MC_MOTION_DURATION.slow, ease: MC_MOTION_EASE.out },
};

/** @type {import('framer-motion').Variants} */
export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 4 },
  transition: { duration: MC_MOTION_DURATION.slow, ease: MC_MOTION_EASE.out },
};

/** @type {import('framer-motion').Variants} */
export const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { duration: MC_MOTION_DURATION.base, ease: MC_MOTION_EASE.spring },
};

/** @type {import('framer-motion').Variants} */
export const slideInRight = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 8 },
  transition: { duration: MC_MOTION_DURATION.slow, ease: MC_MOTION_EASE.out },
};

/** @type {import('framer-motion').Variants} */
export const panelReveal = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: { duration: MC_MOTION_DURATION.base, ease: MC_MOTION_EASE.inOut },
};

/** Hover/tap for interactive cards and buttons */
export const interactiveMotion = {
  whileHover: { y: -1, transition: { duration: MC_MOTION_DURATION.fast } },
  whileTap: { scale: 0.98, transition: { duration: MC_MOTION_DURATION.fast } },
};

/** Stagger children (lists, menus) */
export const staggerContainer = {
  animate: {
    transition: { staggerChildren: 0.04, delayChildren: 0.02 },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: MC_MOTION_DURATION.base, ease: MC_MOTION_EASE.out },
};
