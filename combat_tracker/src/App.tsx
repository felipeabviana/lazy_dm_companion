import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CombatantList } from './components/CombatantList';
import { AddCombatantModal } from './components/AddCombatantModal';
import { ConditionModal } from './components/ConditionModal';
import { AddCounterModal } from './components/AddCounterModal';
import { EncounterLibraryDrawer } from './components/EncounterLibraryDrawer';
import { useCombat } from './context/CombatContext';
import { History, ChevronUp, ChevronDown } from 'lucide-react';

export const App: React.FC = () => {
  const { encounter, activeModal, openModal, nextTurn, prevTurn, isConfirmModalOpen } = useCombat();
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeModal || isConfirmModalOpen) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (target.closest('[data-modal]') || target.closest('[data-confirm-modal]')) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        openModal('add_combatant');
      } else if (e.key === ' ' && e.shiftKey) {
        e.preventDefault();
        prevTurn();
      } else if (e.key === ' ') {
        e.preventDefault();
        nextTurn();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal, openModal, nextTurn, prevTurn]);

  const lastLogEntry = encounter.historyLog.length > 0
    ? encounter.historyLog[encounter.historyLog.length - 1]
    : 'Ready for battle.';

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors selection:bg-amber-500 selection:text-white overflow-hidden">
      {/* Top Application Header */}
      <Header />

      {/* Main Scrollable Viewport */}
      <main className="flex-1 w-full overflow-y-auto min-h-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-12">
          <CombatantList />
        </div>
      </main>

      {/* Bottom Live History Log Bar */}
      <footer className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-4 sm:px-6 py-2.5 transition-colors z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-hidden">
            <History className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">
              Combat Log:
            </span>
            <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
              {lastLogEntry}
            </span>
          </div>

          <button
            onClick={() => setShowLog(prev => !prev)}
            className="flex items-center gap-1 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 shrink-0 transition-colors"
          >
            <span>{showLog ? 'Hide History' : 'Full History'}</span>
            {showLog ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Collapsible History Drawer */}
        {showLog && (
          <div className="max-w-5xl mx-auto mt-2 max-h-48 overflow-y-auto border-t border-zinc-100 dark:border-zinc-800/80 pt-2 flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            {encounter.historyLog.slice().reverse().map((entry, idx) => (
              <div key={idx} className="py-0.5 border-b border-zinc-50 dark:border-zinc-800/40 last:border-0">
                • {entry}
              </div>
            ))}
          </div>
        )}
      </footer>

      {/* Interactive Modals & Drawers */}
      <AddCombatantModal />
      <ConditionModal />
      <AddCounterModal />
      <EncounterLibraryDrawer />
    </div>
  );
};

export default App;
