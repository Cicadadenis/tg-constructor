import React from 'react';
import { BuilderUiContext } from '../builderContext.js';
import { softenEngineeringCopy } from '../copy/productCopy.js';
import { useGraphValidation } from './graphValidationContext.jsx';

/** Subtle non-blocking hint during editing (no toast, no modal). */
export default function CanvasSoftValidationHint() {
  const ctx = React.useContext(BuilderUiContext);
  const lang = ctx?.lang || 'ru';
  const validation = useGraphValidation();
  const soft = validation?.softStatus;
  if (!soft || soft.badge === 'ok') return null;
  const hint = soft.hints?.[0];
  if (!hint?.title) return null;
  const title = softenEngineeringCopy(hint.title, lang);

  return (
    <div
      role="status"
      style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        zIndex: 33,
        maxWidth: 'min(320px, calc(100% - 24px))',
        padding: '8px 12px',
        fontSize: 10,
        lineHeight: 1.45,
        color: soft.badge === 'errors' ? '#fecaca' : '#fde68a',
        background: 'rgba(15,15,20,0.88)',
        border: `1px solid ${soft.badge === 'errors' ? 'rgba(248,113,113,0.4)' : 'rgba(251,191,36,0.35)'}`,
        borderRadius: 10,
        pointerEvents: 'none',
        backdropFilter: 'blur(6px)',
      }}
    >
      {title}
    </div>
  );
}
