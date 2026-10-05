import React, { useState } from 'react';
import { useCombat } from '../context/CombatContext';
import { X, Plus } from 'lucide-react';

const COMMON_COUNTERS = [
  { name: 'Stamina', max: 5 },
  { name: 'Defense', max: 20 },
  { name: 'Spell Slots', max: 4 },
  { name: 'Ammo', max: 20 },
  { name: 'Action Surge', max: 1 },
  { name: 'Rage', max: 3 },
  { name: 'Ki Points', max: 6 },
  { name: 'Luck', max: 3 },
];

export const AddCounterModal: React.FC = () => {
  const { activeModal, modalTarget, closeModal, addCustomCounter } = useCombat();

  const [name, setName] = useState('');
  const [value, setValue] = useState<number>(3);
  const [max, setMax] = useState<number | undefined>(3);

  if (activeModal !== 'add_counter' || !modalTarget) return null;

  const handleSelectQuick = (counter: { name: string; max?: number }) => {
    setName(counter.name);
    setValue(counter.max || 1);
    setMax(counter.max);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addCustomCounter(modalTarget.id, {
      name: name.trim(),
      value,
      max: max !== undefined ? Math.max(value, max) : undefined,
    });
    closeModal();
    setName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/80">
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">
              Add Custom Counter
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              For: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{modalTarget.name}</span>
            </p>
          </div>
          <button
            onClick={closeModal}
            className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {/* Quick Suggestions */}
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
              Common Counters
            </span>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_COUNTERS.map((sug) => (
                <button
                  key={sug.name}
                  type="button"
                  onClick={() => handleSelectQuick(sug)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 transition-all"
                >
                  {sug.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
              Counter Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Stamina, Spell Slots, Defense"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Current Value
              </label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold text-center"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Max (Optional)
              </label>
              <input
                type="number"
                value={max === undefined ? '' : max}
                placeholder="No max"
                onChange={(e) => setMax(e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold text-center"
              />
            </div>
          </div>

          <button
            type="submit"
            className="mt-2 w-full py-3 rounded-xl font-bold text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition-all active:scale-98 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Attach Counter</span>
          </button>
        </form>
      </div>
    </div>
  );
};
