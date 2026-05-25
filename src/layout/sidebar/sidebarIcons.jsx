import React from 'react';

/** @param {object} props */
function Icon({ children, className = '' }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const SidebarIcons = {
  flows: (
    <Icon>
      <path d="M4 6h6v12H4zM14 4h6v16h-6z" />
    </Icon>
  ),
  audience: (
    <Icon>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  ),
  broadcasts: (
    <Icon>
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </Icon>
  ),
  automations: (
    <Icon>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  ),
  templates: (
    <Icon>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </Icon>
  ),
  analytics: (
    <Icon>
      <path d="M3 3v18h18" />
      <path d="M7 16l4-6 4 3 5-8" />
    </Icon>
  ),
  settings: (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </Icon>
  ),
  search: (
    <Icon className="mc-sidebar-icon mc-sidebar-icon--sm">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </Icon>
  ),
  star: (
    <Icon className="mc-sidebar-icon mc-sidebar-icon--sm">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z" />
    </Icon>
  ),
  chevron: (
    <Icon className="mc-sidebar-icon mc-sidebar-icon--xs">
      <path d="M9 6l6 6-6 6" />
    </Icon>
  ),
  panel: (
    <Icon className="mc-sidebar-icon mc-sidebar-icon--sm">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </Icon>
  ),
  plus: (
    <Icon className="mc-sidebar-icon mc-sidebar-icon--sm">
      <path d="M12 5v14M5 12h14" />
    </Icon>
  ),
};
