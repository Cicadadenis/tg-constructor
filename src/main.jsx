import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppDialogProvider } from './dialog/AppDialogProvider.jsx';
import { API_URL } from './apiClient.js';
import { prefetchCsrfToken } from './csrf.js';
import './index.css';

prefetchCsrfToken(API_URL).catch(() => {});

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppDialogProvider>
    <App />
  </AppDialogProvider>,
);
