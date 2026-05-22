import React from 'react';

/**
 * AI onboarding card — only mounted when canvas has no user-visible nodes.
 * No full-screen blocker: wrapper is pointer-events:none, card only captures clicks.
 */
export default function CanvasOnboardingOverlay({
  show = false,
  builderUi,
  canUseAiGenerator,
  onOpenAi,
  onStartTour,
}) {
  if (!show) return null;

  return (
    <div
      data-testid="canvas-onboarding-overlay"
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 4,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div
        className="editor-empty-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          pointerEvents: 'auto',
          background: 'rgba(13,9,32,0.6)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 24,
          padding: '36px 44px',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
          maxWidth: 360,
        }}
      >
        <div
          style={{
            fontSize: 48,
            background: 'linear-gradient(135deg, #f97316, #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 24px rgba(249,115,22,0.45))',
            animation: 'editorNeonPulse 3s ease-in-out infinite',
          }}
        >
          ✦
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)',
            fontFamily: 'Syne, system-ui',
            letterSpacing: '-0.02em',
            textAlign: 'center',
          }}
        >
          {builderUi.emptyCanvasTitle}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.38)',
            textAlign: 'center',
            maxWidth: 280,
            lineHeight: 1.6,
          }}
        >
          {canUseAiGenerator
            ? builderUi.emptyCanvasSubPro
            : builderUi.emptyCanvasSubFree}
        </div>
        <button
          type="button"
          onClick={onOpenAi}
          style={{
            padding: '13px 32px',
            fontSize: 14,
            fontWeight: 700,
            fontFamily: 'Syne, system-ui',
            background: canUseAiGenerator
              ? 'linear-gradient(135deg, #f97316, #dc2626)'
              : 'rgba(255,255,255,0.06)',
            color: canUseAiGenerator ? '#fff' : 'rgba(253,230,138,0.72)',
            border: canUseAiGenerator ? 'none' : '1px solid rgba(251,191,36,0.18)',
            borderRadius: 14,
            cursor: 'pointer',
            boxShadow: canUseAiGenerator ? '0 8px 28px rgba(249,115,22,0.45)' : 'none',
            opacity: canUseAiGenerator ? 1 : 0.7,
          }}
        >
          {canUseAiGenerator ? builderUi.emptyCanvasAi : `🔒 ${builderUi.emptyCanvasAiLocked}`}
        </button>
        <button
          type="button"
          onClick={onStartTour}
          style={{
            padding: '8px 18px',
            fontSize: 12,
            color: 'rgba(255,255,255,0.5)',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            cursor: 'pointer',
          }}
        >
          {builderUi.emptyCanvasTour}
        </button>
        <div
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.18)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ flex: 1, height: 1, background: 'rgba(99,102,241,0.2)', display: 'block', width: 60 }} />
          {builderUi.emptyCanvasDrag}
          <span style={{ flex: 1, height: 1, background: 'rgba(99,102,241,0.2)', display: 'block', width: 60 }} />
        </div>
      </div>
    </div>
  );
}
