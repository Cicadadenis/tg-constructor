import React from 'react';

/** @typedef {'ok'|'warnings'|'errors'} ValidationBadge */

export const GraphValidationContext = React.createContext(null);

export function GraphValidationProvider(props) {
  const {
    children,
    softStatus,
    fullResult,
    fullCheckBusy,
    requestFullValidation,
    dismissFullOverlay,
    blockingOverlayActive,
    lastRepairResult,
    repairHighlight,
    repairBusy,
    requestAutoRepair,
    undoLastRepair,
    showRepairHighlights,
  } = props;
  const value = React.useMemo(() => ({
    softStatus,
    fullResult,
    fullCheckBusy,
    requestFullValidation,
    dismissFullOverlay,
    blockingOverlayActive,
    lastRepairResult,
    repairHighlight,
    repairBusy,
    requestAutoRepair,
    undoLastRepair,
    showRepairHighlights,
  }), [
    softStatus,
    fullResult,
    fullCheckBusy,
    requestFullValidation,
    dismissFullOverlay,
    blockingOverlayActive,
    lastRepairResult,
    repairHighlight,
    repairBusy,
    requestAutoRepair,
    undoLastRepair,
    showRepairHighlights,
  ]);

  return (
    <GraphValidationContext.Provider value={value}>
      {children}
    </GraphValidationContext.Provider>
  );
}

export function useGraphValidation() {
  return React.useContext(GraphValidationContext);
}
