import React, { useCallback, useMemo, useState } from 'react';
import { useAnalytics } from './useAnalytics.js';
import OverviewDashboard from './dashboards/OverviewDashboard.jsx';
import FunnelDashboard from './dashboards/FunnelDashboard.jsx';
import FlowAnalyticsDashboard from './dashboards/FlowAnalyticsDashboard.jsx';
import NodeAnalyticsDashboard from './dashboards/NodeAnalyticsDashboard.jsx';
import PerformanceDashboard from './dashboards/PerformanceDashboard.jsx';
import ObservabilityDashboard from './dashboards/ObservabilityDashboard.jsx';
import RealtimeKpiStrip from './components/RealtimeKpiStrip.jsx';
import { getAnalyticsLabels } from './analyticsLabels.js';
import { defaultEngineClient } from '../constructor/engineClient.js';
import './analytics-hub.css';

const TAB_IDS = ['overview', 'performance', 'funnel', 'flow', 'nodes', 'observe'];

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
  lang = 'ru',
}) {
  const [tab, setTab] = useState('overview');
  const labels = React.useMemo(() => getAnalyticsLabels(lang), [lang]);
  const { snapshot, reset, streamConnected } = useAnalytics({ flowId, nodeIds, realtime: open });

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
          <h2 className="analytics-hub__title">{labels.title}</h2>
        </div>
        <div className="analytics-hub__actions">
          <button type="button" className="analytics-btn" onClick={reset}>{labels.reset}</button>
          <button type="button" className="analytics-btn analytics-btn--ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </header>

      <RealtimeKpiStrip
        snapshot={snapshot}
        streamConnected={streamConnected}
        labels={labels.kpi}
      />

      <nav className="analytics-hub__tabs" role="tablist">
        {TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`analytics-hub__tab ${tab === id ? 'is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {labels.tabs[id]}
          </button>
        ))}
      </nav>

      <div className="analytics-hub__body">
        {tab === 'overview' && <OverviewDashboard snapshot={snapshot} labels={labels} />}
        {tab === 'performance' && (
          <PerformanceDashboard snapshot={snapshot} labels={labels.performance} />
        )}
        {tab === 'funnel' && (
          <FunnelDashboard snapshot={snapshot} nodeLabel={nodeLabel} labels={labels} />
        )}
        {tab === 'flow' && (
          <FlowAnalyticsDashboard snapshot={snapshot} nodeLabel={nodeLabel} labels={labels} />
        )}
        {tab === 'nodes' && (
          <NodeAnalyticsDashboard
            snapshot={snapshot}
            nodeLabel={nodeLabel}
            lang={lang}
            onNodeClick={(id) => onHighlightNodes?.([id])}
          />
        )}
        {tab === 'observe' && (
          <ObservabilityDashboard
            snapshot={snapshot}
            traceId={lastTraceId}
            nodeLabel={nodeLabel}
            labels={labels}
            onFetchTrace={(id) => defaultEngineClient.fetchTrace(id)}
            onHighlightNodes={onHighlightNodes}
          />
        )}
      </div>
    </div>
  );
}
