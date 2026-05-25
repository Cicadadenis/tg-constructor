import React, { useRef, useEffect } from 'react';
import { getProductUiLabels } from '../../copy/productCopy.js';

/**
 * Horizontal automation path — highlights current step in the flow.
 */
export default function ExecutionPathRail({
  steps = [],
  activeNodeId = null,
  busy = false,
  lang = 'ru',
  onStepClick,
}) {
  const scrollRef = useRef(null);
  const label = getProductUiLabels(lang).automationPath;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector('[data-active="true"]');
    active?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [activeNodeId, steps.length]);

  if (!steps.length && !activeNodeId) return null;

  const items = [...steps].slice(-12);

  return (
    <div className="tg-sim-path" aria-label={label}>
      <span className="tg-sim-path__label">{label}</span>
      <div ref={scrollRef} className="tg-sim-path__track">
        {items.map((step) => {
          const nodeId = step.nodeIds?.[step.nodeIds.length - 1];
          const isActive = nodeId && nodeId === activeNodeId;
          const title = step.nodeLabels?.join(' → ') || step.inbound;
          return (
            <button
              key={step.id}
              type="button"
              className={`tg-sim-path__chip${isActive ? ' tg-sim-path__chip--active' : ''}${busy && isActive ? ' tg-sim-path__chip--busy' : ''}`}
              data-active={isActive ? 'true' : undefined}
              title={title}
              onClick={() => nodeId && onStepClick?.(nodeId)}
            >
              <span className="tg-sim-path__chip-in">{step.inbound}</span>
              {step.nodeLabels?.[0] && (
                <span className="tg-sim-path__chip-node">{step.nodeLabels[0]}</span>
              )}
              {step.branchPort && (
                <span className={`tg-sim-path__chip-branch tg-sim-path__chip-branch--${step.branchPort}`}>
                  {step.branchPort}
                </span>
              )}
            </button>
          );
        })}
        {activeNodeId && !items.some((s) => s.nodeIds?.includes(activeNodeId)) && (
          <span className="tg-sim-path__chip tg-sim-path__chip--active" data-active="true">
            <span className="tg-sim-path__chip-node">{activeNodeId}</span>
          </span>
        )}
      </div>
    </div>
  );
}
