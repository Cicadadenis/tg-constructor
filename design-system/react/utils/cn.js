import { clsx } from 'clsx';

/**
 * Merge class names (Tailwind-friendly).
 * @param {...import('clsx').ClassValue} inputs
 * @returns {string}
 */
export function cn(...inputs) {
  return clsx(inputs);
}
