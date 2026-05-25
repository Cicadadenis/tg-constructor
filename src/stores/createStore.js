import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

const DEV = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

/**
 * @template T
 * @param {import('zustand').StateCreator<T>} initializer
 * @param {string} name
 */
export function createImmerStore(initializer, name) {
  const wrapped = immer(initializer);
  if (DEV) {
    return create(subscribeWithSelector(devtools(wrapped, { name })));
  }
  return create(subscribeWithSelector(wrapped));
}

export { create, subscribeWithSelector, immer, devtools };
