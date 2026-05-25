/**
 * App motion system — Framer Motion presets + helpers.
 */

export {
  MC_MOTION_DURATION,
  MC_MOTION_EASE,
  MC_SPRING,
  motionTransition,
  fadeIn,
  fadeUp,
  scaleIn,
  slideInRight,
  slideInLeft,
  railPanelVariants,
  inspectorPanelVariants,
  paletteBackdropVariants,
  paletteSheetVariants,
  nodeSurfaceVariants,
  nodeToolbarVariants,
  panelReveal,
  collapseVariants,
  interactiveMotion,
  pressableMotion,
  staggerContainer,
  staggerItem,
  tabPanelVariants,
  skeletonPulse,
} from '../../design-system/motion/presets.js';

export { useReducedMotion } from './useReducedMotion.js';
export { useMotionPrefs, default as MotionProvider } from './MotionProvider.jsx';
export { MotionPressable } from './MotionPressable.jsx';
export { MotionSkeleton, MotionSkeletonList } from './MotionSkeleton.jsx';
