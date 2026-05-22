import React from 'react';

const GraphCanvasActionsContext = React.createContext(null);

export function GraphCanvasActionsProvider({ value, children }) {
  return (
    <GraphCanvasActionsContext.Provider value={value}>
      {children}
    </GraphCanvasActionsContext.Provider>
  );
}

export function useGraphCanvasActions() {
  return React.useContext(GraphCanvasActionsContext);
}
