import React from 'react';

/**
 * Collapsible inspector section.
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.hint]
 * @param {boolean} [props.defaultOpen]
 * @param {React.ReactNode} props.children
 */
export default function InspectorSection({
  title,
  hint,
  defaultOpen = true,
  children,
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <section className="entity-inspector__section">
      <button
        type="button"
        className="entity-inspector__section-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="entity-inspector__section-title">{title}</span>
        {hint && <span className="entity-inspector__section-hint">{hint}</span>}
        <span className="entity-inspector__section-chevron" aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="entity-inspector__section-body">
          {children}
        </div>
      )}
    </section>
  );
}
