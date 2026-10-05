import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { CombatProvider } from './context/CombatContext';
import { ViewOnlyTracker } from './components/ViewOnlyTracker';
import './index.css';

const isViewOnly = new URLSearchParams(window.location.search).get('mode') === 'view';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isViewOnly ? (
      // Standalone view-only mode: no CombatProvider needed, state comes via IPC
      <ViewOnlyTracker />
    ) : (
      <CombatProvider>
        <App />
      </CombatProvider>
    )}
  </React.StrictMode>,
);
