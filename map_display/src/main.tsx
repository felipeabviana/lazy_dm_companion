import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ViewOnlyMap } from './components/ViewOnlyMap';
import './index.css';

const isViewOnly = new URLSearchParams(window.location.search).get('mode') === 'view';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isViewOnly ? (
      // Standalone view-only mode: state comes via IPC
      <ViewOnlyMap />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
