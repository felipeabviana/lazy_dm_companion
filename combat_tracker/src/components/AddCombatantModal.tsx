import React, { useState, useEffect } from 'react';
import { useCombat } from '../context/CombatContext';
import { X, Users, User, Skull, Plus } from 'lucide-react';

export const AddCombatantModal: React.FC = () => {
  const { activeModal, closeModal, addCombatant, addCombatantsBatch } = useCombat();

  const [name, setName] = useState('');
  const [initiative, setInitiative] = useState<string>('');
  const [maxHp, setMaxHp] = useState<string>('');
  const [currentHp, setCurrentHp] = useState<string>('');
  const [isNpc, setIsNpc] = useState<boolean>(true);
  const [count, setCount] = useState<number>(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeModal]);

  if (activeModal !== 'add_combatant') return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const parsedMaxHp = parseInt(maxHp, 10);
    const parsedCurrentHp = parseInt(currentHp, 10);
    const parsedInitiative = parseInt(initiative, 10);

    const baseCombatant = {
      name: name.trim(),
      initiative: isNaN(parsedInitiative) ? 0 : parsedInitiative,
      currentHp: isNaN(parsedCurrentHp) ? (isNaN(parsedMaxHp) ? 1 : parsedMaxHp) : parsedCurrentHp,
      maxHp: isNaN(parsedMaxHp) ? 1 : parsedMaxHp,
      isNpc,
      customCounters: [],
      conditions: [],
    };

    if (count > 1) {
      addCombatantsBatch(baseCombatant, count);
    } else {
      addCombatant(baseCombatant);
    }

    closeModal();
    // Reset form
    setName('');
    setInitiative('');
    setMaxHp('');
    setCurrentHp('');
    setCount(1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/80">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">
            Add Combatant
          </h3>
          <button
            onClick={closeModal}
            className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {/* Name & Count */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Goblin, Paladin, Bugbear"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                autoFocus
              />
            </div>

            <div className="w-24">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>Count</span>
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={count}
                onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-center font-bold"
              />
            </div>
          </div>

          {/* Ally vs Enemy Toggle */}
          <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-700/60">
            <button
              type="button"
              onClick={() => setIsNpc(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
                !isNpc
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <User className="w-3.5 h-3.5 text-emerald-500" />
              <span>Ally</span>
            </button>
            <button
              type="button"
              onClick={() => setIsNpc(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
                isNpc
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Skull className="w-3.5 h-3.5 text-rose-500" />
              <span>Enemy</span>
            </button>
          </div>

          {/* Initiative & HP Row */}
          <div className="grid grid-cols-3 gap-3">
            {/* Initiative */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Initiative
              </label>
              <input
                type="number"
                placeholder="—"
                value={initiative}
                onChange={(e) => setInitiative(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold text-center"
              />
            </div>

            {/* Current HP */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Current HP
              </label>
              <input
                type="number"
                placeholder="—"
                value={currentHp}
                onChange={(e) => setCurrentHp(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold text-center"
              />
            </div>

            {/* Max HP */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Max HP
              </label>
              <input
                type="number"
                placeholder="—"
                value={maxHp}
                onChange={(e) => setMaxHp(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold text-center"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="mt-2 w-full py-3 rounded-xl font-bold text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition-all active:scale-98 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add to Encounter</span>
          </button>
        </form>
      </div>
    </div>
  );
};
