import React, { useEffect, useState } from 'react';
import { Encounter, Combatant, Condition } from '../types/combat';

const STORAGE_KEY_ENCOUNTER = 'dm_companion_active_encounter';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function readEncounterFromStorage(): Encounter | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ENCOUNTER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── Condition badge ──────────────────────────────────────────────────────────
const ConditionBadge: React.FC<{ condition: Condition }> = ({ condition }) => (
  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
    {condition.name}
    {condition.durationRounds !== undefined && (
      <span className="ml-1 opacity-70">{condition.durationRounds}r</span>
    )}
  </span>
);

// ─── Single row ───────────────────────────────────────────────────────────────
const CombatantRow: React.FC<{ combatant: Combatant; isActive: boolean; index: number }> = ({
  combatant,
  isActive,
  index,
}) => (
  <div
    className={[
      'flex items-start gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0 transition-colors',
      isActive
        ? 'bg-amber-50 dark:bg-amber-950/30 border-l-4 border-l-amber-400'
        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/30',
    ].join(' ')}
  >
    {/* Turn indicator */}
    <div className="w-6 shrink-0 flex items-center justify-center">
      {isActive ? (
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
      ) : (
        <span className="text-xs text-zinc-400 dark:text-zinc-600 font-mono">{index + 1}</span>
      )}
    </div>

    {/* Name + conditions */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span
          className={[
            'font-semibold truncate text-sm',
            isActive
              ? 'text-amber-700 dark:text-amber-300'
              : combatant.isNpc
              ? 'text-red-700 dark:text-red-400'
              : 'text-zinc-800 dark:text-zinc-100',
          ].join(' ')}
        >
          {combatant.name}
        </span>
        {combatant.isNpc ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold border border-red-200 dark:border-red-800 shrink-0">
            Enemy
          </span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-200 dark:border-emerald-800 shrink-0">
            Ally
          </span>
        )}
      </div>
      {combatant.conditions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {combatant.conditions.map(c => (
            <ConditionBadge key={c.id} condition={c} />
          ))}
        </div>
      )}
    </div>

    {/* Initiative */}
    <div className="shrink-0 text-right">
      <div className="text-xs text-zinc-400 dark:text-zinc-500 mb-0.5">Init</div>
      <div className="text-base font-bold font-mono text-zinc-700 dark:text-zinc-200">
        {combatant.initiative}
      </div>
    </div>
  </div>
);

// ─── Main view-only component ─────────────────────────────────────────────────
export const ViewOnlyTracker: React.FC = () => {
  const [encounter, setEncounter] = useState<Encounter | null>(null);

  useEffect(() => {
    // Apply dark mode
    document.documentElement.classList.add('dark');

    if (window.electronAPI) {
      // ── Electron path: use IPC ──────────────────────────────────────────────
      window.electronAPI.requestState().then(state => {
        if (state) setEncounter(state as Encounter);
      });

      const unsubscribe = window.electronAPI.onStateUpdate(state => {
        setEncounter(state as Encounter);
      });

      return () => unsubscribe();
    } else {
      // ── Browser / dev path: use localStorage + storage events ───────────────
      // Read the current snapshot immediately
      const initial = readEncounterFromStorage();
      if (initial) setEncounter(initial);

      // Listen for changes written by the main tab via CombatContext
      const onStorage = (e: StorageEvent) => {
        if (e.key === STORAGE_KEY_ENCOUNTER && e.newValue) {
          try {
            setEncounter(JSON.parse(e.newValue));
          } catch {
            // ignore malformed data
          }
        }
      };

      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }
  }, []);

  if (!encounter) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950 text-zinc-500 text-sm">
        Waiting for tracker data…
      </div>
    );
  }

  const activeCombatant = encounter.combatants.find(c => c.id === encounter.activeCombatantId) ?? null;

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans">
      {/* Header */}
      <header className="shrink-0 px-4 py-3 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-bold text-zinc-100 truncate">{encounter.name}</h1>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-zinc-400">
              Round <span className="font-bold text-amber-400">{encounter.round}</span>
            </span>
            {activeCombatant && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                {activeCombatant.name}'s turn
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Combatant list */}
      <main className="flex-1 overflow-y-auto min-h-0">
        {encounter.combatants.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
            No combatants yet.
          </div>
        ) : (
          encounter.combatants.map((c, i) => (
            <CombatantRow
              key={c.id}
              combatant={c}
              isActive={c.id === encounter.activeCombatantId}
              index={i}
            />
          ))
        )}
      </main>

      {/* Footer */}
      <footer className="shrink-0 px-4 py-2 border-t border-zinc-800 bg-zinc-900/80 text-center">
        <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Player View</span>
      </footer>
    </div>
  );
};
