import React from 'react';
import { cn } from '../utils/cn.js';

const CATEGORY_CLASS = {
  messaging: 'mc-node-card--messaging',
  logic: 'mc-node-card--logic',
  ai: 'mc-node-card--ai',
  data: 'mc-node-card--data',
  db: 'mc-node-card--data',
  trigger: 'mc-node-card--messaging',
};

/**
 * Flow node card foundation — pair with React Flow handles in parent.
 * Does not replace FlowNodeCard; use for new flows or gradual migration.
 *
 * @param {object} props
 * @param {'messaging'|'logic'|'ai'|'data'|'db'|'trigger'} [props.category]
 * @param {string} props.title
 * @param {string} [props.categoryLabel]
 * @param {React.ReactNode} [props.icon]
 * @param {React.ReactNode} [props.body]
 * @param {React.ReactNode} [props.footer]
 * @param {boolean} [props.selected]
 */
export function NodeCard({
  className,
  category = 'messaging',
  title,
  categoryLabel,
  icon,
  body,
  footer,
  selected = false,
  children,
  ...rest
}) {
  return (
    <article
      className={cn(
        'mc-node-card',
        CATEGORY_CLASS[category] || CATEGORY_CLASS.messaging,
        selected && 'mc-node-card--selected',
        className,
      )}
      data-selected={selected || undefined}
      {...rest}
    >
      <header className="mc-node-card__header">
        {icon && <div className="mc-node-card__icon">{icon}</div>}
        <div>
          {categoryLabel && (
            <div className="mc-node-card__category">{categoryLabel}</div>
          )}
          <div className="mc-node-card__title">{title}</div>
        </div>
      </header>
      {(body || children) && (
        <div className="mc-node-card__body">{body ?? children}</div>
      )}
      {footer}
    </article>
  );
}

export default NodeCard;
