import React, { useCallback, useMemo, useState } from 'react';
import { useAnalytics } from './useAnalytics.js';
import OverviewDashboard from './dashboards/OverviewDashboard.jsx';
import FunnelDashboard from './dashboards/FunnelDashboard.jsx';
import FlowAnalyticsDashboard from './dashboards/FlowAnalyticsDashboard.jsx';
import NodeAnalyticsDashboard from './dashboards/NodeAnalyticsDashboard.jsx';
import ObservabilityDashboard from './dashboards/ObservabilityDashboard.jsx';
import { defaultEngineClient } from '../constructor/engineClient.js';
import './analytics-hub.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'funnel', label: 'Funnel' },
  { id: 'flow', label: 'Flow' },
  { id: 'nodes', label: 'Nodes' },
  { id: 'observe', label: 'Observability' },
];

/**
 * ManyChat-style analytics hub — SaaS dashboards + realtime metrics.
 */
export default function AnalyticsHub({
  open,
  onClose,
  flowId,
  nodeIds = [],
  getGraphDocument,
  onHighlightNodes,
  lastTraceId = null,
  panelPos = null,
  onPanelPosChange,
  isMobileView = false,
}) {
  const [tab, setTab] = useState('overview');
  const { snapshot, reset } = useAnalytics({ flowId, nodeIds, realtime: open });

  const nodeLabel = useCallback((nodeId) => {
    if (!nodeId || !getGraphDocument) return nodeId || '—';
    const n = getGraphDocument()?.nodes?.[nodeId];
    if (!n) return nodeId;
    const p = n.data?.props ?? n.props ?? {};
    return p.title || p.label || n.type || nodeId;
  }, [getGraphDocument]);

  const dragRef = React.useRef(null);
  const panelRef = React.useRef(null);

  const startDrag = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target.closest?.('button, input, a, select')) return;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    onPanelPosChange?.({ left: rect.left, top: rect.top });
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      width: rect.width,
      height: rect.height,
    };
    const move = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      let left = d.originLeft + (ev.clientX - d.startX);
      let top = d.originTop + (ev.clientY - d.startY);
      const margin = 8;
      left = Math.max(margin, Math.min(left, window.innerWidth - d.width - margin));
      top = Math.max(margin, Math.min(top, window.innerHeight - d.height - margin));
      onPanelPosChange?.({ left, top });
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    e.preventDefault();
  }, [onPanelPosChange]);

  const posStyle = useMemo(() => {
    if (panelPos) return { left: panelPos.left, top: panelPos.top, right: 'auto', bottom: 'auto' };
    if (isMobileView) return { left: 8, right: 8, top: 72, bottom: 'auto' };
    return { left: 20, top: 88, right: 'auto', bottom: 'auto' };
  }, [panelPos, isMobileView]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className={`analytics-hub ${isMobileView ? 'analytics-hub--mobile' : ''}`}
      style={posStyle}
      role="dialog"
      aria-label="Analytics"
    >
      <header className="analytics-hub__head" onMouseDown={startDrag}>
        <div>
          <h2 className="analytics-hub__title">Analytics</h2>
          <span className="analytics-hub__live">● live</span>
        </div>
        <div className="analytics-hub__actions">
          <button type="button" className="analytics-btn" onClick={reset}>Reset</button>
          <button type="button" className="analytics-btn analytics-btn--ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </header>

      <nav className="analytics-hub__tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`analytics-hub__tab ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="analytics-hub__body">
        {tab === 'overview' && <OverviewDashboard snapshot={snapshot} />}
        {tab === 'funnel' && <FunnelDashboard snapshot={snapshot} nodeLabel={nodeLabel} />}
        {tab === 'flow' && <FlowAnalyticsDashboard snapshot={snapshot} nodeLabel={nodeLabel} />}
        {tab === 'nodes' && (
          <NodeAnalyticsDashboard
            snapshot={snapshot}
            nodeLabel={nodeLabel}
            onNodeClick={(id) => onHighlightNodes?.([id])}
          />
        )}
        {tab === 'observe' && (
          <ObservabilityDashboard
            snapshot={snapshot}
            traceId={lastTraceId}
            nodeLabel={nodeLabel}
            onFetchTrace={(id) => defaultEngineClient.fetchTrace(id)}
            onHighlightNodes={onHighlightNodes}
          />
        )}
      </div>
    </div>
  );
}
