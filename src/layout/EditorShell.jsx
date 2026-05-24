import React from 'react';
import { useAppLayout } from './AppLayoutContext.jsx';
import './editor-shell.css';

/**
 * Fixed 3-zone shell: LEFT | CENTER | RIGHT. No page-level scroll.
 * @param {object} props
 * @param {React.ReactNode} props.left
 * @param {React.ReactNode} props.center
 * @param {React.ReactNode} props.right
 * @param {React.ReactNode} [props.mobileNav]
 */
export default function EditorShell({ left, center, right, mobileNav = null }) {
  const { isMobile, mobileZone } = useAppLayout();

  const leftVisible = !isMobile || mobileZone === 'left';
  const centerVisible = !isMobile || mobileZone === 'canvas';
  const rightVisible = !isMobile || mobileZone === 'right';

  return (
    <div className="editor-shell__body">
      <div className="app-three-zone editor-main-grid">
        <div className={!leftVisible ? 'app-zone--hidden-mobile' : undefined}>
          {left}
        </div>
        <div className={!centerVisible ? 'app-zone--hidden-mobile' : undefined}>
          {center}
        </div>
        <div
          className={[
            !rightVisible ? 'app-zone--hidden-mobile' : '',
          ].filter(Boolean).join(' ') || undefined}
        >
          {right}
        </div>
      </div>
      {isMobile && mobileNav}
    </div>
  );
}
