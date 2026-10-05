import React from 'react';
import ReactDOM from 'react-dom/client';
import { CombatProvider } from './context/CombatContext';
import { CombatantList } from './components/CombatantList';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <CombatProvider>
      <CombatantList />
    </CombatProvider>
  </React.StrictMode>
);
