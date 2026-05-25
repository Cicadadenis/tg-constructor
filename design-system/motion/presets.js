/**
 * Framer Motion presets — Linear / Raycast / ManyChat feel.
 * Durations mirror design-system/tokens; springs tuned for premium SaaS UI.
 */

export const MC_MOTION_DURATION = {
  instant: 0.08,
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

/** Spring physics presets */
export const MC_SPRING = {
  /** Panels, drawers, rails */
  panel: { type: 'spring', stiffness: 420, damping: 36, mass: 0.85 },
  /** Floating toolbars, popovers */
  toolbar: { type: 'spring', stiffness: 520, damping: 34, mass: 0.65 },
  /** Flow step cards */
  node: { type: 'spring', stiffness: 400, damping: 30, mass: 0.75 },
  /** Snappy micro-interactions */
  snappy: { type: 'spring', stiffness: 680, damping: 38, mass: 0.5 },
  /** Soft settle (lists, empty states) */
  gentle: { type: 'spring', stiffness: 320, damping: 32, mass: 0.9 },
  /** Drawer / modal */
  overlay: { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 },
};

/** @param {boolean} reduced */
export function motionTransition(reduced, fallback) {
  if (reduced) return { duration: 0 };
  return fallback;
}

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
export const slideInLeft = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
  transition: MC_SPRING.overlay,
};

/** Floating rail (left) */
export const railPanelVariants = {
  hidden: { opacity: 0, x: -24, scale: 0.98 },
  visible: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -16, scale: 0.98 },
};

/** Inspector (right) */
export const inspectorPanelVariants = {
  hidden: { opacity: 0, x: 24, scale: 0.98 },
  visible: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: 16, scale: 0.98 },
};

/** Command palette backdrop + sheet */
export const paletteBackdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: MC_MOTION_DURATION.fast } },
  exit: { opacity: 0, transition: { duration: MC_MOTION_DURATION.fast } },
};

export const paletteSheetVariants = {
  initial: { opacity: 0, scale: 0.96, y: -10 },
  animate: { opacity: 1, scale: 1, y: 0, transition: MC_SPRING.snappy },
  exit: { opacity: 0, scale: 0.98, y: -6, transition: { duration: MC_MOTION_DURATION.fast } },
};

/** Node card surface states */
export const nodeSurfaceVariants = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.012, y: -2 },
  selected: { scale: 1.016, y: -3 },
};

/** Toolbar above nodes — use with initial/animate/exit prop names */
export const nodeToolbarVariants = {
  initial: { opacity: 0, y: 8, scale: 0.94 },
  animate: { opacity: 1, y: 0, scale: 1, transition: MC_SPRING.toolbar },
  exit: { opacity: 0, y: 6, scale: 0.96, transition: { duration: MC_MOTION_DURATION.fast } },
};

/** @type {import('framer-motion').Variants} */
export const panelReveal = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: { duration: MC_MOTION_DURATION.base, ease: MC_MOTION_EASE.inOut },
};

/** Sidebar collapsible group */
export const collapseVariants = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1, transition: MC_SPRING.gentle },
  exit: { height: 0, opacity: 0, transition: { duration: MC_MOTION_DURATION.base } },
};

/** Hover/tap for interactive cards and buttons */
export const interactiveMotion = {
  whileHover: { y: -1, transition: { duration: MC_MOTION_DURATION.fast } },
  whileTap: { scale: 0.98, transition: { duration: MC_MOTION_DURATION.fast } },
};

/** Icon / toolbar button */
export const pressableMotion = {
  whileHover: { scale: 1.06 },
  whileTap: { scale: 0.94 },
  transition: MC_SPRING.snappy,
};

/** Stagger children (lists, menus) */
export const staggerContainer = {
  initial: 'hidden',
  animate: 'show',
  variants: {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.045, delayChildren: 0.03 },
    },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: MC_MOTION_DURATION.base, ease: MC_MOTION_EASE.out },
  },
};

/** Tab panel crossfade */
export const tabPanelVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: MC_MOTION_DURATION.base, ease: MC_MOTION_EASE.out } },
  exit: { opacity: 0, y: -4, transition: { duration: MC_MOTION_DURATION.fast } },
};

/** Skeleton pulse */
export const skeletonPulse = {
  animate: {
    opacity: [0.45, 0.85, 0.45],
  },
  transition: {
    duration: 1.4,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};
