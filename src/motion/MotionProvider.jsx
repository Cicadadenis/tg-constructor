import React, { createContext, useContext, useEffect } from 'react';
import { useReducedMotion } from './useReducedMotion.js';

const MotionContext = createContext({ reducedMotion: false });

export function useMotionPrefs() {
  return useContext(MotionContext);
}

/**
 * Sets data-reduced-motion on document for CSS fallbacks.
 */
export default function MotionProvider({ children }) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const root = document.documentElement;
    if (reducedMotion) {
      root.setAttribute('data-reduced-motion', 'true');
    } else {
      root.removeAttribute('data-reduced-motion');
    }
  }, [reducedMotion]);

  return (
    <MotionContext.Provider value={{ reducedMotion }}>
      {children}
    </MotionContext.Provider>
  );
}
