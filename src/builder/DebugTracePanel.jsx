/**
 * Debug trace UI — read-only LEVEL_0 + DEV transpile trace.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { defaultEngineClient } from '../constructor/engineClient.js';
import { getProductUiLabels } from '../copy/productCopy.js';
import {
  buildTimeline,
  highlightNodesFromTrace,
  parseLevel0Trace,
} from '../constructor/traceViewer.js';

export function DebugTracePanel({
  open,
  traceId,
  transpileTrace = [],
  compileWarnings = [],
  onClose,
  onHighlightChange,
  lang = 'ru',
}) {
  const p = getProductUiLabels(lang);
  const [events, setEvents] = useState([]);
  const [replayIndex, setReplayIndex] = useState(0);
  const [showTranspile, setShowTranspile] = useState(true);

  useEffect(() => {
    if (!open || !traceId) {
      setEvents([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const payload = await defaultEngineClient.fetchTrace(traceId);
        if (cancelled) return;
        const parsed = parseLevel0Trace(payload);
        setEvents(parsed.events);
        setReplayIndex(Math.max(0, parsed.events.length - 1));
      } catch {
        if (!cancelled) setEvents([]);
      }
    })();
    const unsub = defaultEngineClient.subscribeTrace?.(traceId, (payload) => {
      const parsed = parseLevel0Trace(payload);
      setEvents(parsed.events);
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [open, traceId]);

  const sliced = useMemo(
    () => events.slice(0, replayIndex + 1),
    [events, replayIndex],
  );
  const highlights = useMemo(() => highlightNodesFromTrace(sliced), [sliced]);
  const timeline = useMemo(() => buildTimeline(sliced), [sliced]);
  const lastHighlightRef = useRef(null);

  useEffect(() => {
    if (!open) {
      const empty = { active: [], visited: [] };
      const prev = lastHighlightRef.current;
      if (
        prev
        && prev.active.length === 0
        && prev.visited.length === 0
      ) {
        return;
      }
      lastHighlightRef.current = empty;
      onHighlightChange?.(empty);
      return;
    }
    const prev = lastHighlightRef.current;
    const same =
      prev
      && prev.active.length === highlights.active.length
      && prev.visited.length === highlights.visited.length
      && prev.active.every((id, i) => id === highlights.active[i])
      && prev.visited.every((id, i) => id === highlights.visited[i]);
    if (same) return;
    lastHighlightRef.current = highlights;
    onHighlightChange?.(highlights);
  }, [open, highlights, onHighlightChange]);

  if (!open) return null;

  return (
    <motionlessTraceBox>
      <motionlessTraceHeader title={p.conversationTrace} onClose={onClose} />
      <input
        type="range"
        min={0}
        max={Math.max(0, events.length - 1)}
        value={replayIndex}
        onChange={(e) => setReplayIndex(Number(e.target.value))}
        style={{ width: '100%', marginBottom: 8 }}
      />
      <div style={{ maxHeight: 140, overflow: 'auto' }}>
        {timeline.map((row) => (
          <motionlessTimelineRow key={row.seq} row={row} />
        ))}
      </div>
      <motionlessTraceFooter
        countLabel={typeof p.eventsCount === 'function' ? p.eventsCount(events.length) : `${events.length}`}
        activeLabel={typeof p.activeSteps === 'function' ? p.activeSteps(highlights.active) : highlights.active.join(', ')}
      />

      {import.meta.env?.DEV && (
        <motionlessTranspileSection
          title={p.technicalDetails}
          show={showTranspile}
          onToggle={() => setShowTranspile((v) => !v)}
          transpileTrace={transpileTrace}
          compileWarnings={compileWarnings}
        />
      )}
    </motionlessTraceBox>
  );
}

function motionlessTraceBox({ children }) {
  return (
    <motionlessTraceContainer>
      {children}
    </motionlessTraceContainer>
  );
}

function motionlessTraceContainer({ children }) {
  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        width: 360,
        maxHeight: 420,
        overflow: 'auto',
        background: 'rgba(13,9,32,0.95)',
        border: '1px solid rgba(99,102,241,0.35)',
        borderRadius: 12,
        padding: 12,
        zIndex: 9000,
        fontSize: 12,
        color: '#e2e8f0',
      }}
    >
      {children}
    </div>
  );
}

function motionlessTraceHeader({ title, onClose }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontWeight: 700 }}>
      <span>{title}</span>
      <button type="button" onClick={onClose} aria-label="Close">✕</button>
    </div>
  );
}

function motionlessTimelineRow({ row }) {
  return (
    <div style={{ padding: '2px 0', opacity: 0.9 }}>
      <span>{row.kind}</span>
    </div>
  );
}

function motionlessTraceFooter({ countLabel, activeLabel }) {
  return (
    <div style={{ marginTop: 8, opacity: 0.55 }}>
      {countLabel}
      {activeLabel && activeLabel !== '—' ? ` · ${activeLabel}` : ''}
    </div>
  );
}

function motionlessTranspileSection({ title, show, onToggle, transpileTrace, compileWarnings }) {
  return (
    <div style={{ marginTop: 10, borderTop: '1px solid rgba(99,102,241,0.25)', paddingTop: 8 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#a5b4fc',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 700,
          padding: 0,
          marginBottom: 6,
        }}
      >
        {show ? '▼' : '▶'} {title} ({transpileTrace.length})
      </button>
      {show && (
        <div style={{ maxHeight: 160, overflow: 'auto', fontSize: 10 }}>
          {(compileWarnings || []).map((w, i) => (
            <motionlessWarn key={`w-${i}`} text={w} />
          ))}
          {(transpileTrace || []).map((row, i) => (
            <div
              key={`tr-${i}`}
              style={{
                marginBottom: 6,
                padding: '4px 6px',
                background: 'rgba(15,23,42,0.5)',
                borderRadius: 6,
              }}
            >
              <div style={{ opacity: 0.75 }}>
                <span>{row.blockType}</span>
              </div>
              <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', opacity: 0.85 }}>
                {(row.generatedLines || []).join('\n')}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function motionlessWarn({ text }) {
  return <div style={{ color: '#fbbf24', marginBottom: 4 }}>{text}</div>;
}

export default DebugTracePanel;
