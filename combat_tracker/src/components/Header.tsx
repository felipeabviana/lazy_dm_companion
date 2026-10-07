import React, { useState, useEffect } from 'react';
import { useCombat } from '../context/CombatContext';
import { KeyboardShortcutsInfo } from './KeyboardShortcutsInfo';

import { ChevronLeft, ChevronRight, UserPlus, ArrowUpDown, RotateCcw, BookOpen, Sun, Moon, Edit2, Check, ShieldAlert, Plus, AlertTriangle, Eye } from 'lucide-react';

export const Header: React.FC = () => {
  const {
    encounter,
    activeCombatant,
    nextTurn,
    prevTurn,
    setEncounterName,
    sortInitiative,
    resetEncounter,
    startNewEncounter,
    isDarkMode,
    toggleDarkMode,
    openModal,
    isConfirmModalOpen: showConfirmModal,
    setConfirmModalOpen: setShowConfirmModal,
  } = useCombat();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(encounter.name);

  useEffect(() => {
    if (!showConfirmModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowConfirmModal(false);
      } else if (e.key === 'Enter') {
        startNewEncounter();
        setTimeout(() => setShowConfirmModal(false), 0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showConfirmModal, startNewEncounter, setShowConfirmModal]);

  const handleTitleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (titleInput.trim()) {
      setEncounterName(titleInput.trim());
    }
    setIsEditingTitle(false);
  };

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md px-6 py-4 sticky top-0 z-30 flex flex-col lg:flex-row items-center justify-between gap-4 transition-colors">
      {/* Left: App Brand & Encounter Title, New Encounter Button */}
      <div className="flex items-center gap-3.5 w-full md:w-auto">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-zinc-600 dark:text-zinc-300">
              Combat Tracker
            </span>
            {isEditingTitle ? (
              <form onSubmit={handleTitleSubmit} className="flex items-center gap-1.5 mt-0.5">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  className="px-2 py-0.5 text-base font-bold rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  autoFocus
                  onBlur={handleTitleSubmit}
                />
                <button
                  type="submit"
                  className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                >
                  <Check className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <div
                onClick={() => {
                  setTitleInput(encounter.name);
                  setIsEditingTitle(true);
                }}
                className="flex items-center gap-2 cursor-pointer group"
                title="Click to rename encounter"
              >
                <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  {encounter.name}
                </h1>
                <Edit2 className="w-3.5 h-3.5 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>
        </div>

        <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block shrink-0" />

        <button
          onClick={() => setShowConfirmModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition-all active:scale-95 shadow-2xs shrink-0"
          title="Clear list and start a fresh encounter"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="whitespace-nowrap">New Encounter</span>
        </button>

        <KeyboardShortcutsInfo />
      </div>

      {/* Center: Turn Navigation & Round Counter */}
      <div className="flex items-center gap-3">
        {/* Round Badge */}
        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800/80 rounded-xl px-3 py-1.5 border border-zinc-200 dark:border-zinc-700/60 shadow-sm">
          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 block leading-tight">
            Round
          </span>
          <span className="text-base font-black text-zinc-900 dark:text-zinc-100 ml-1.5">
            {encounter.round}
          </span>
        </div>

        {/* Turn Navigation Buttons */}
        <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700/60 shadow-sm">
          <button
            onClick={prevTurn}
            disabled={encounter.combatants.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 disabled:opacity-40 transition-all"
            title="Go to previous combatant"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="whitespace-nowrap">Prev</span>
          </button>

          <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700" />

          <button
            onClick={nextTurn}
            disabled={encounter.combatants.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold text-white bg-amber-600 hover:bg-amber-500 active:scale-95 disabled:opacity-40 disabled:hover:bg-amber-600 shadow-sm transition-all"
            title="Advance to next combatant"
          >
            <span className="whitespace-nowrap">Next Turn</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Current Active Indicator Pill */}
        {activeCombatant && (
          <div className="hidden lg:flex flex-col text-left pl-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400">
              Active Turn
            </span>
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[140px]">
              {activeCombatant.name}
            </span>
          </div>
        )}
      </div>

      {/* Right: Quick Tools & Settings */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => openModal('add_combatant')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition-colors"
          title="Add character or monster"
        >
          <UserPlus className="w-4 h-4" />
          <span className="hidden sm:inline whitespace-nowrap">Add Combatant</span>
        </button>

        <button
          onClick={sortInitiative}
          className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
          title="Sort list by Initiative (High to Low)"
        >
          <ArrowUpDown className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            if (window.confirm('Reset round counter to 1 and restart encounter?')) {
              resetEncounter();
            }
          }}
          className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
          title="Reset to Round 1"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={() => openModal('library')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 transition-colors"
          title="Open Presets & Import/Export"
        >
          <BookOpen className="w-4 h-4" />
          <span className="hidden md:inline whitespace-nowrap">Library</span>
        </button>

        <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />

        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button
          onClick={() => {
            if (window.electronAPI) {
              // Electron: open a native second window
              window.electronAPI.createViewOnly();
            } else {
              // Browser / dev mode: open a new tab with ?mode=view
              window.open(window.location.href.split('?')[0] + '?mode=view', '_blank');
            }
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
          title="Open view‑only window"
        >
          <Eye className="w-4 h-4" />
          <span className="hidden md:inline whitespace-nowrap">Player View</span>
        </button>
      </div>

      {/* Confirmation Modal for Starting New Encounter */}
      {showConfirmModal && (
        <div data-confirm-modal className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div data-modal className="w-full max-w-sm rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden p-6 flex flex-col gap-4 text-left">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Start New Encounter?
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  This will clear all combatants and start fresh.
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950/60 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 leading-relaxed">
              All current combatants, health pools, and round progress will be wiped. A new encounter with the default name <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">"New Encounter"</strong> will be started.
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  startNewEncounter();
                  setShowConfirmModal(false);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 active:scale-95 shadow-sm transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Confirm & Clear</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
