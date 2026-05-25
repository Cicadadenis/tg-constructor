import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppDialogProvider } from './dialog/AppDialogProvider.jsx';
import { API_URL } from './apiClient.js';
import { prefetchCsrfToken } from './csrf.js';
import { initDevErrorLogging } from './debug/devLog.js';
import './index.css';
import './layout/editor-shell.css';
import { initMcDesignSystem } from '../design-system/index.js';

initMcDesignSystem({ theme: 'light' });
initDevErrorLogging();
prefetchCsrfToken(API_URL).catch(() => {});

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppDialogProvider>
    <App />
  </AppDialogProvider>,
);
