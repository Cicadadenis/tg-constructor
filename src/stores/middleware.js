import { immer } from 'zustand/middleware/immer';

/**
 * Zustand + Immer — draft mutations for plain state slices only.
 * Graph editor class instance lives outside immer drafts (see graphStore).
 */
export { immer };
