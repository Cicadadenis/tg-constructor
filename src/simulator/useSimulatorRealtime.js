import { useEffect, useState } from 'react';
import { SimulatorEventTypes } from './simulatorEventBus.js';

/**
 * Subscribe to simulator event bus for realtime UI (canvas overlays, side panels).
 * @param {ReturnType<import('./simulatorEventBus.js').createSimulatorEventBus>|null} bus
 */
export function useSimulatorRealtime(bus) {
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [variables, setVariables] = useState({});
  const [typing, setTyping] = useState(false);
  const [stepBusy, setStepBusy] = useState(false);
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    if (!bus) return undefined;

    const unsubs = [
      bus.on(SimulatorEventTypes.ACTIVE_NODE, setActiveNodeId),
      bus.on(SimulatorEventTypes.VARIABLES, setVariables),
      bus.on(SimulatorEventTypes.TYPING, setTyping),
      bus.on(SimulatorEventTypes.STEP_START, () => {
        setStepBusy(true);
        setLastError(null);
      }),
      bus.on(SimulatorEventTypes.STEP_END, () => setStepBusy(false)),
      bus.on(SimulatorEventTypes.ERROR, setLastError),
      bus.on(SimulatorEventTypes.RESET, () => {
        setActiveNodeId(null);
        setVariables({});
        setTyping(false);
        setStepBusy(false);
        setLastError(null);
      }),
    ];

    return () => unsubs.forEach((off) => off());
  }, [bus]);

  return {
    activeNodeId,
    variables,
    typing,
    stepBusy,
    lastError,
  };
}
