import React from 'react';
import { BuilderUiContext } from '../../builderContext.js';
import { EdgeQuickBlockPicker } from './EdgeQuickBlockPicker.jsx';

/**
 * Holds edge picker state; children receive openPicker via context.
 */
const FlowEdgePickerContext = React.createContext(null);

export function useFlowEdgePicker() {
  return React.useContext(FlowEdgePickerContext);
}

/**
 * @param {object} props
 * @param {(edgeId: string, blockType: string) => void | Promise<void>} props.onInsertOnEdge
 * @param {React.ReactNode} props.children
 */
export function FlowEdgePickerHost({ onInsertOnEdge, children }) {
  const ctx = React.useContext(BuilderUiContext);
  const lang = ctx?.lang || 'ru';
  const blockTypes = ctx?.blockTypes;

  const [picker, setPicker] = React.useState(null);

  const openPicker = React.useCallback((edgeId, anchor) => {
    setPicker({ edgeId, anchor });
  }, []);

  const closePicker = React.useCallback(() => {
    setPicker(null);
  }, []);

  const handlePick = React.useCallback(async (type) => {
    if (!picker?.edgeId) return;
    const edgeId = picker.edgeId;
    closePicker();
    await onInsertOnEdge?.(edgeId, type);
  }, [picker, closePicker, onInsertOnEdge]);

  const value = React.useMemo(() => ({
    openPicker,
    closePicker,
    activeEdgeId: picker?.edgeId || null,
    lang,
  }), [openPicker, closePicker, picker?.edgeId, lang]);

  return (
    <FlowEdgePickerContext.Provider value={value}>
      {children}
      {picker && (
        <EdgeQuickBlockPicker
          anchor={picker.anchor}
          lang={lang}
          blockTypes={blockTypes}
          onPick={handlePick}
          onClose={closePicker}
        />
      )}
    </FlowEdgePickerContext.Provider>
  );
}
