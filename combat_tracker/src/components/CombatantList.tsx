import React, { useEffect, useRef } from 'react';
import { useCombat } from '../context/CombatContext';
import { CombatantCard } from './CombatantCard';
import { Swords, UserPlus, BookOpen } from 'lucide-react';

export const CombatantList: React.FC = () => {
  const { encounter, openModal } = useCombat();
  const activeCardRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to active combatant if they are out of view
  useEffect(() => {
    if (activeCardRef.current) {
      activeCardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [encounter.activeCombatantId]);

  if (encounter.combatants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl my-8">
        <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500 mb-4">
          <Swords className="w-10 h-10" />
        </div>
        <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">
          No Combatants in the Arena
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mt-1 mb-6">
          Add player characters and monsters to start tracking initiative order, health pools, and conditions.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => openModal('add_combatant')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Combatant</span>
          </button>
          <button
            onClick={() => openModal('library')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 transition-all"
          >
            <BookOpen className="w-4 h-4" />
            <span>Load Preset</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-8">
      {encounter.combatants.map((combatant, idx) => {
        const isActive = combatant.id === encounter.activeCombatantId;
        return (
          <div
            key={combatant.id}
            ref={isActive ? activeCardRef : null}
            className="scroll-my-6 transition-all"
          >
            <CombatantCard
              combatant={combatant}
              isActive={isActive}
            />
          </div>
        );
      })}
    </div>
  );
};
