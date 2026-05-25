import React, { useCallback, useMemo, useState } from 'react';
import { useAnalytics } from './useAnalytics.js';
import { getAnalyticsLabels } from './analyticsLabels.js';
import RealtimeKpiStrip from './components/RealtimeKpiStrip.jsx';
import OverviewDashboard from './dashboards/OverviewDashboard.jsx';
import FunnelDashboard from './dashboards/FunnelDashboard.jsx';
import FlowAnalyticsDashboard from './dashboards/FlowAnalyticsDashboard.jsx';
import NodeAnalyticsDashboard from './dashboards/NodeAnalyticsDashboard.jsx';
import PerformanceDashboard from './dashboards/PerformanceDashboard.jsx';
import ObservabilityDashboard from './dashboards/ObservabilityDashboard.jsx';
import { defaultEngineClient } from '../constructor/engineClient.js';
import './analytics-workspace.css';

const TABS = [
  { id: 'overview', labelKey: 'overview' },
  { id: 'performance', labelKey: 'performance' },
  { id: 'funnel', labelKey: 'funnel' },
  { id: 'flow', labelKey: 'flow' },
  { id: 'nodes', labelKey: 'nodes' },
  { id: 'observe', labelKey: 'observe' },
];

/**
 * Embedded ManyChat-style analytics workspace (sidebar / full panel).
 */
export default function AnalyticsWorkspace({
  flowId,
  nodeIds = [],
  lang = 'ru',
  getGraphDocument,
  onHighlightNodes,
  lastTraceId = null,
  onPopout,
  className = '',
}) {
  const [tab, setTab] = useState('overview');
  const { snapshot, reset, streamConnected } = useAnalytics({
    flowId,
    nodeIds,
    realtime: true,
  });

  const labels = useMemo(() => getAnalyticsLabels(lang), [lang]);

  const nodeLabel = useCallback((nodeId) => {
    if (!nodeId || !getGraphDocument) return nodeId || '—';
    const n = getGraphDocument()?.nodes?.[nodeId];
    if (!n) return nodeId;
    const p = n.data?.props ?? n.props ?? {};
    return p.title || p.label || n.type || nodeId;
  }, [getGraphDocument]);

  return (
    <div className={`analytics-workspace ${className}`.trim()} data-tour="analytics-workspace">
      <header className="analytics-workspace__head">
        <div>
          <h2 className="analytics-workspace__title">{labels.title}</h2>
          <p className="analytics-workspace__subtitle">{labels.subtitle}</p>
        </div>
        <div className="analytics-workspace__actions">
          {onPopout && (
            <button type="button" className="analytics-btn" onClick={onPopout}>
              {labels.popout}
            </button>
          )}
          <button type="button" className="analytics-btn" onClick={reset}>
            {labels.reset}
          </button>
        </div>
      </header>

      <RealtimeKpiStrip
        snapshot={snapshot}
        streamConnected={streamConnected}
        labels={labels.kpi}
      />

      <nav className="analytics-workspace__tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`analytics-workspace__tab ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {labels.tabs[t.labelKey]}
          </button>
        ))}
      </nav>

      <div className="analytics-workspace__body">
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
