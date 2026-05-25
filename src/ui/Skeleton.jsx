import React from 'react';

/**
 * @param {object} props
 * @param {'text' | 'title' | 'row' | 'block'} [props.variant]
 * @param {string} [props.className]
 * @param {React.CSSProperties} [props.style]
 */
export function Skeleton({ variant = 'text', className = '', style }) {
  return (
    <span
      className={`ds-skeleton ds-skeleton--${variant} ${className}`.trim()}
      style={style}
      aria-hidden
    />
  );
}

/**
 * @param {object} props
 * @param {number} [props.rows]
 */
export function SkeletonList({ rows = 4 }) {
  return (
    <div className="ds-skeleton-list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="row" />
      ))}
    </div>
  );
}
