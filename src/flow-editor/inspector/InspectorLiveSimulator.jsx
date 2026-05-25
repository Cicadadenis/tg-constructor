import React from 'react';
import ChatSimulatorPanel from '../../simulator/ChatSimulatorPanel.jsx';

/**
 * Full live chat simulator embedded in the right inspector rail.
 */
export default function InspectorLiveSimulator({
  lang = 'ru',
  onUndock,
  ...simProps
}) {
  return (
    <div className="fi-live-sim" data-tour="live-simulator">
      <ChatSimulatorPanel
        open
        variant="docked"
        inspectorEmbed
        lang={lang}
        onClose={undefined}
        onUndock={onUndock}
        {...simProps}
      />
    </div>
  );
}
